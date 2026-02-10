
## 权限级守卫（角色 / 权限）

```jsx
function PermissionRoute({ allow }: { allow: string[] }) {
  const permissions = useAuthStore(s => s.permissions);

  if (!allow.some(p => permissions.includes(p))) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
```

```jsx
<Route element={<PermissionRoute allow={['ADMIN']} />}>
  <Route path="/admin" element={<Admin />} />
</Route>
```

