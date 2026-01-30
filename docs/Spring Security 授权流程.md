## Spring Security + redis token ??

UsernamePasswordAuthenticationToken

## ===========================

## 1️⃣ Spring Security 默认理解的表结构（可选模板）

Spring Security 自带的 JDBC `JdbcDaoImpl` 默认使用：

| 表名          | 字段                              | 用途                                |
| ------------- | --------------------------------- | ----------------------------------- |
| `users`       | `username`, `password`, `enabled` | 用户基本信息                        |
| `authorities` | `username`, `authority`           | 用户角色/权限（每行一个 authority） |

> 这是默认的模板，方便直接用 JDBC 配置。但你不必完全照搬

------

## 2️⃣ 关键要求是 `UserDetails`

`UserDetailsService.loadUserByUsername()` 必须返回 **一个实现了 `UserDetails` 的对象**：

```
public interface UserDetails {
    String getUsername();
    String getPassword();
    Collection<? extends GrantedAuthority> getAuthorities();
    boolean isAccountNonExpired();
    boolean isAccountNonLocked();
    boolean isCredentialsNonExpired();
    boolean isEnabled();
}
```

你需要保证：

- 用户名/密码有对应字段
- 角色/权限能转成 `Collection<GrantedAuthority>`
- 账号状态字段可以返回 `isEnabled() / isLocked()` 等

**这就是核心要求**，并不是一定要建固定表，只要你的实体能提供这些信息就行。

------

## 3️⃣ 如何对接你现有的表

你现在的表和逻辑：

- `User` 表：`id, username, password` ✅
- `Permission` 表 + 关联表：你已经有 `permissionRepository.findUserPermissions(userId)` 来查权限 ✅

那可以这样写 `UserDetails` 实现：

```java
public class LoginUser implements UserDetails {

    private final User user;
    private final List<PermissionResultDTO> permissions;

    public LoginUser(User user, List<PermissionResultDTO> permissions) {
        this.user = user;
        this.permissions = permissions;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return permissions.stream()
                .map(p -> new SimpleGrantedAuthority(p.getCode()))
                .collect(Collectors.toList());
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public String getUsername() {
        return user.getUserName();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true; // 根据你的字段可以改
    }

    @Override
    public boolean isAccountNonLocked() {
        return !user.isLocked();
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return user.isEnabled();
    }
}
```

> ✅ 这样你就可以用你现有表，返回 Spring Security 需要的数据
>  不必创建默认 `users` / `authorities` 表

------

## 4️⃣ 小结

- **不用按 Spring Security 默认建表**
- **必须满足 `UserDetails` 接口的数据需求**
- **角色/权限只要能转换成 `GrantedAuthority`** 就行
- 你的现有 `User + Permission` 表完全可以满足，只要写一个 `LoginUser` 或类似实现