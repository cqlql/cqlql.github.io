

Feature-driven Development (FDD)

FDD（Feature First）



轻量FDD

```
features
├─user
│  ├─api.ts
│  ├─types.ts
│  ├─UserList.tsx
│  └─UserForm.tsx
│
├─role
│  ├─api.ts
│  ├─types.ts
│  └─RoleList.tsx
│
├─invite
│  ├─api.ts
│  └─InviteRuleList.tsx
```

纯FDD

```
features
└─user
    ├─api
    ├─components
    ├─hooks
    ├─store
    ├─utils
    ├─constants
    ├─services
    ├─types
    ├─pages
```

