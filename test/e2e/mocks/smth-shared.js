const cache = new Map();

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeQuery(input) {
  const obj = input && typeof input === "object" ? { ...input } : {};
  if ("page" in obj) obj.page = toPositiveInt(obj.page, 1);
  if ("limit" in obj) obj.limit = toPositiveInt(obj.limit, 10);
  return obj;
}

function createSchema(name) {
  return {
    parse(input) {
      if (name === "NotificationSettingsSchema") {
        const valid =
          input &&
          typeof input === "object" &&
          !Array.isArray(input) &&
          typeof input.likes === "boolean" &&
          typeof input.comments === "boolean" &&
          typeof input.subscriptions === "boolean" &&
          typeof input.articleStatus === "boolean";
        if (valid) return input;
        return {
          likes: true,
          comments: true,
          subscriptions: true,
          articleStatus: true,
        };
      }
      if (name && name.endsWith("QuerySchema")) {
        return normalizeQuery(input);
      }
      return input;
    },
    safeParse(input) {
      if (name === "NotificationSettingsSchema") {
        const valid =
          input &&
          typeof input === "object" &&
          !Array.isArray(input) &&
          typeof input.likes === "boolean" &&
          typeof input.comments === "boolean" &&
          typeof input.subscriptions === "boolean" &&
          typeof input.articleStatus === "boolean";
        if (!valid) return { success: false, error: { issues: [] } };
      }
      return { success: true, data: this.parse(input) };
    },
    array() {
      return createSchema(name);
    },
  };
}

const shared = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === "__esModule") return true;
      if (prop === "default") return shared;
      if (typeof prop !== "string") return undefined;

      if (cache.has(prop)) {
        return cache.get(prop);
      }

      if (prop.endsWith("Schema")) {
        const schema = createSchema(prop);
        cache.set(prop, schema);
        return schema;
      }

      if (prop === "Content") {
        const value = {};
        cache.set(prop, value);
        return value;
      }

      const value = {};
      cache.set(prop, value);
      return value;
    },
  },
);

module.exports = shared;
