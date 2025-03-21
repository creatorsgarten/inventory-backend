import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { createCache } from "async-cache-dedupe";
import { Elysia, t } from "elysia";
import { GristDocAPI } from "grist-api";

const api = new GristDocAPI(Deno.env.get("GRIST_DOC_URL")!, {
  apiKey: Deno.env.get("GRIST_API_KEY")!,
});

interface GristItem {
  id: number;
  manualSort: number;
  ID2: string;
  Name: string;
  Description: string;
  Tag: number;
  CreatedAt: number;
  UpdatedAt: number;
}

interface GristTag {
  id: number;
  manualSort: number;
  ID2: string;
  CreatedAt: number;
  UpdatedAt: number;
  // LinkedItem: string; // computed
}

const cache = createCache({ ttl: 60 }).define(
  "fetchTable",
  (tableName: string) => {
    return api.fetchTable(tableName);
  }
);

const fetchItems = async (): Promise<GristItem[]> => {
  return (await cache.fetchTable("Items")) as unknown as GristItem[];
};

const fetchTags = async (): Promise<GristTag[]> => {
  return (await cache.fetchTable("Tags")) as unknown as GristTag[];
};

// Types matching the commons/types.ts file
enum TagType {
  Item = "ITEM",
  Container = "CONTAINER",
}

enum PossessionType {
  Unspecified = "UNSPECIFIED",
  User = "USER",
  Container = "CONTAINER",
}

interface Item {
  id: string;
  name: string;
  description: string;
  notes: string;
  imageUrl?: string;
  type: TagType;
  tags?: string[];
  possession: {
    type: PossessionType;
    id: string;
  };
  createdAt: string; // ISOTimestamp
  updatedAt: string; // ISOTimestamp
}

interface Tag {
  id: string;
  link: {
    id: string;
    type: TagType;
  } | null;
  createdAt: string; // ISOTimestamp
  updatedAt: string; // ISOTimestamp
}

// Utility to convert timestamp to ISO format
const toISOTimestamp = (timestamp: number): string => {
  return new Date(timestamp * 1000).toJSON();
};

class Filters<T> {
  criteria: ((item: T) => boolean)[] = [];
  addCriteria(criteria: (item: T) => boolean) {
    this.criteria.push(criteria);
  }
  match(item: T): boolean {
    return this.criteria.every((criteria) => criteria(item));
  }

  static in<T>(values: string[], getter: (item: T) => string | string[]) {
    const set = new Set(values);
    return (item: T) => {
      const result = getter(item);
      const values = Array.isArray(result) ? result : [result];
      return values.some((value) => set.has(value));
    };
  }
}

export default new Elysia()
  .use(cors())
  .get(
    "/",
    () =>
      new Response(null, {
        status: 302,
        headers: { Location: "/swagger" },
      })
  )
  .get(
    "/items",
    async ({ query }): Promise<Item[]> => {
      const [items, tags] = await Promise.all([fetchItems(), fetchTags()]);
      const tagMap = new Map(tags.map((tag) => [tag.id, tag]));

      const filters = new Filters<Item>();
      if (query.id) {
        const queryIds = query.id.split(",");
        filters.addCriteria(Filters.in(queryIds, (item) => item.id));
      }
      if (query.tag) {
        const queryTags = query.tag.split(",");
        filters.addCriteria(Filters.in(queryTags, (item) => item.tags || []));
      }

      return items
        .map((item): Item => {
          const tag = tagMap.get(item.Tag);
          const itemTags = tag ? [tag.ID2] : [];
          return {
            id: item.ID2,
            name: item.Name,
            description: item.Description,
            notes: "",
            imageUrl: undefined,
            type: TagType.Item,
            tags: itemTags,
            possession: {
              type: PossessionType.Unspecified,
              id: "",
            },
            createdAt: toISOTimestamp(item.CreatedAt),
            updatedAt: toISOTimestamp(item.UpdatedAt),
          };
        })
        .filter((item) => filters.match(item));
    },
    {
      detail: {
        description:
          "Retrieves a list of items from the inventory. Can be filtered by item ID or by tags.",
      },
      query: t.Object({
        id: t.Optional(
          t.String({
            description: "Filter by item ID(s). Accepts comma-separated values",
          })
        ),
        tag: t.Optional(
          t.String({
            description:
              "Comma-separated list of tag IDs to filter by. Returns items that have any of the specified tags.",
          })
        ),
      }),
    }
  )
  .get(
    "/tags",
    async ({ query }): Promise<Tag[]> => {
      const [items, tags] = await Promise.all([fetchItems(), fetchTags()]);
      const itemByTag = new Map<number, string>(
        items.map((item) => [item.Tag, item.ID2])
      );
      const filters = new Filters<Tag>();
      if (query.id) {
        const queryIds = query.id.split(",");
        filters.addCriteria(Filters.in(queryIds, (tag) => tag.id));
      }

      return tags
        .map((tag): Tag => {
          const itemId = itemByTag.get(tag.id);
          return {
            id: tag.ID2,
            link: itemId ? { id: itemId, type: TagType.Item } : null,
            createdAt: toISOTimestamp(tag.CreatedAt),
            updatedAt: toISOTimestamp(tag.UpdatedAt),
          };
        })
        .filter((tag) => filters.match(tag));
    },
    {
      detail: {
        description:
          "Retrieves a list of tags used in the inventory system. Can be filtered by tag ID.",
      },
      query: t.Object({
        id: t.Optional(
          t.String({
            description:
              "Filter by exact tag ID(s). Accepts comma-separated values",
          })
        ),
      }),
    }
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "Inventorygarten backend",
          description: "API for Inventorygarten",
          version: "0.0.1",
        },
      },
    }) as any
  );
