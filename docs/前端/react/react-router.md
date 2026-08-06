## 路由方式

### 组件式（最传统）

👉 基于 `<BrowserRouter> + <Routes> + <Route>`

适合小项目

```jsx
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

```jsx
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

src\layouts\AuthLayout.tsx

```jsx
import { Navigate, Outlet, useMatches } from 'react-router-dom';

export default function AuthLayout() {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const matches = useMatches();
  const currentMatch = matches[matches.length - 1];

  const requiredRole = (currentMatch.handle as RouteHandle)?.role;

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}

type RouteHandle = {
  role?: string;
};
```

src\layouts\GuestLayout.tsx

```jsx
import { Navigate, Outlet } from 'react-router-dom';

export default function GuestLayout() {
  const token = localStorage.getItem('token');

  if (token) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

```

src\router\routes.tsx

```jsx
import Layout from '@/layouts/MainLayout';
import Login from '@/pages/Login/Login';
import Home from '@/pages/Home';
import type { RouteObject } from 'react-router-dom';
import { type ReactNode } from 'react';
import { RobotOutlined, UserOutlined, HomeOutlined } from '@ant-design/icons';
import AuthLayout from '@/layouts/AuthLayout';
import GuestLayout from '@/layouts/GuestLayout';
import { User } from './lazy';

export type AppRouteObject = RouteObject & {
  meta?: {
    title: string;
    icon?: ReactNode;
    hidden?: boolean;
  };
  children?: AppRouteObject[];
};

export const routes: AppRouteObject[] = [
  {
    element: <GuestLayout />,
    children: [
      { path: '/login', element: <Login /> },
      // { path: "/register", element: <Register /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      {
        element: <Layout />,
        children: [
          {
            path: '/',
            index: true,
            element: <Home />,
            meta: { title: '首页', icon: <HomeOutlined /> },
          },
          {
            path: '/user',
            element: <User />,
            meta: { title: '用户管理', icon: <UserOutlined /> },
          }
        ],
      },
    ],
  },
];

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

