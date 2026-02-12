
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

## 懒加载

```jsx
import React, { Suspense, lazy } from "react"

const VoiceRouter = lazy(() => import("../features/realtime-voice/router"))

export const AppRouter = () => {
  return (
    <Routes>
      <Route
        path="/voice/*"
        element={
          <Suspense fallback={<div>Loading...</div>}>
            <VoiceRouter />
          </Suspense>
        }
      />
    </Routes>
  )
}

```

