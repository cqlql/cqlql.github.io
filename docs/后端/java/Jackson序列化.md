---
title: Jackson 序列化与反序列化
icon: mdi:code-json
---

# Jackson 序列化与反序列化

类名：`com.fasterxml.jackson.databind.ObjectMapper`

### 1️⃣ JSON → 对象（反序列化）

```
ObjectMapper mapper = new ObjectMapper();

String json = "{\"name\":\"Tom\",\"age\":18}";
User user = mapper.readValue(json, User.class);
```

------

### 2️⃣ 对象 → JSON（序列化）

```
User user = new User("Tom", 18);

String json = mapper.writeValueAsString(user);
```

------

### 3️⃣ JSON → Map（不定义类时）

```
Map<String, Object> map = mapper.readValue(json, Map.class);
```

------

### 4️⃣ JSON 数组 → List

```
List<User> list = mapper.readValue(
    json,
    new TypeReference<List<User>>() {}
);
```