## 实现方式

### 组件式（最传统）

👉 基于 `<BrowserRouter> + <Routes> + <Route>`

适合小项目

```
import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### 配置式（对象路由）（现在主流）

👉 用 JS 对象定义路由，然后交给 Router

👉 这是 React Router v6.4+ 的核心推荐方式

适合中大型项目

```
import { createBrowserRouter, RouterProvider } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { path: "", element: <Home /> },
      { path: "about", element: <About /> }
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />;
}
```



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

## layout 实现

① Layout 组件

```typescript
// Layout.tsx
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="app">
      <header>顶部导航</header>

      <div style={{ display: "flex" }}>
        <aside>侧边栏</aside>

        <main>
          {/* 子路由会渲染在这里 */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

② 路由配置

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Home from "./pages/Home";
import User from "./pages/User";
import Login from "./pages/Login";

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>

        {/* 不需要 Layout 的页面 */}
        <Route path="/login" element={<Login />} />

        {/* 需要 Layout 的页面 */}
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/user" element={<User />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}
```

