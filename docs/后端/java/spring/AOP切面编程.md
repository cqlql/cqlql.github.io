---
title: AOP 切面编程
icon: mdi:creation-outline
---

# Spring AOP 切面编程

> Spring AOP 基于动态代理，用于日志、权限校验、接口耗时、事务等通用逻辑，**不侵入业务代码**。

## 一、Maven 依赖

```xml
<!-- Spring AOP -->
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-aop</artifactId>
</dependency>
<!-- AspectJ 注解支持（Spring 只是借用其注解语法，并非 AspectJ 织入） -->
<dependency>
    <groupId>org.aspectj</groupId>
    <artifactId>aspectjweaver</artifactId>
</dependency>
```

## 二、基础示例（@Aspect 五种通知）

### 2.1 业务接口 & 实现类（目标对象）

```java
public interface UserService {
    void addUser(String username);
    String getUserById(Long id);
}

@Service
public class UserServiceImpl implements UserService {

    @Override
    public void addUser(String username) {
        System.out.println("【业务】新增用户：" + username);
    }

    @Override
    public String getUserById(Long id) {
        System.out.println("【业务】查询用户id=" + id);
        return "用户-" + id;
    }
}
```

### 2.2 切面类 @Aspect

通知类型：

| 通知 | 注解 | 时机 |
| --- | --- | --- |
| 前置通知 | `@Before` | 方法执行前 |
| 返回通知 | `@AfterReturning` | 方法正常返回后（异常不执行） |
| 异常通知 | `@AfterThrowing` | 方法抛出异常时 |
| 后置通知 | `@After` | 方法结束（类似 finally，正常/异常都执行） |
| 环绕通知 | `@Around` | 最强，可手动调用目标方法、控制是否执行、统计耗时 |

```java
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.*;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class LogAspect {

    // 切入点表达式：匹配 com.xxx.service 包下所有类的所有方法
    @Pointcut("execution(* com.xxx.service.*.*(..))")
    public void servicePointCut() {}

    @Before("servicePointCut()")
    public void before(JoinPoint joinPoint) {
        String methodName = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();
        System.out.println("前置通知，方法：" + methodName + "，参数：" + args);
    }

    @AfterReturning(value = "servicePointCut()", returning = "result")
    public void afterReturning(JoinPoint joinPoint, Object result) {
        System.out.println("返回通知，返回值：" + result);
    }

    @AfterThrowing(value = "servicePointCut()", throwing = "ex")
    public void afterThrowing(JoinPoint joinPoint, Exception ex) {
        System.out.println("异常通知：" + ex.getMessage());
    }

    @After("servicePointCut()")
    public void after(JoinPoint joinPoint) {
        System.out.println("后置通知（finally）");
    }

    @Around("servicePointCut()")
    public Object around(ProceedingJoinPoint pjp) throws Throwable {
        long start = System.currentTimeMillis();
        Object ret = pjp.proceed(); // 执行目标方法
        long cost = System.currentTimeMillis() - start;
        System.out.println("环绕通知，耗时：" + cost + " ms");
        return ret;
    }
}
```

### 2.3 启动类开启 AOP

```java
@SpringBootApplication
@EnableAspectJAutoProxy // SpringBoot 默认已开启，可省略
public class AopDemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(AopDemoApplication.class, args);
    }
}
```

## 三、切入点表达式常用写法

```java
// 匹配指定类所有方法
@Pointcut("execution(* com.xxx.service.UserServiceImpl.*(..))")

// 匹配指定方法
@Pointcut("execution(* com.xxx.service.UserService.addUser(..))")

// 注解匹配：匹配带有 @LogRecord 的方法（自定义注解 AOP 常用）
@Pointcut("@annotation(com.xxx.annotation.LogRecord)")
```

## 四、执行顺序

- **正常无异常：** `@Around前置` → `@Before` → 目标方法 → `@AfterReturning` → `@After` → `@Around后置`
- **发生异常：** `@Around前置` → `@Before` → 抛出异常 → `@AfterThrowing` → `@After`（**不执行** `AfterReturning` 和 `Around后置`）

## 五、自定义注解 + AOP（最常用）

场景：自定义注解 `@OperateLog`，加在 Controller 方法上，自动记录操作日志。

### 5.1 自定义注解

```java
@Target(ElementType.METHOD)       // 只能标注在方法上
@Retention(RetentionPolicy.RUNTIME) // 运行时保留，AOP 才能反射读取
@Documented
public @interface OperateLog {
    String desc() default "";            // 操作描述
    String type() default "QUERY";       // 操作类型：ADD / UPDATE / DELETE / QUERY
}
```

### 5.2 切面类（拦截带注解的方法）

```java
@Aspect
@Component
public class OperateLogAspect {

    // 切入点：拦截带有 @OperateLog 注解的方法
    @Pointcut("@annotation(com.xxx.annotation.OperateLog)")
    public void logPointCut() {}

    @Before("logPointCut()")
    public void recordOperateLog(JoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        OperateLog operateLog = method.getAnnotation(OperateLog.class);

        Object[] args = joinPoint.getArgs();
        System.out.println("操作类型：" + operateLog.type());
        System.out.println("操作描述：" + operateLog.desc());
        System.out.println("方法名：" + method.getName());
        System.out.println("请求参数：" + Arrays.toString(args));
    }
}
```

### 5.3 升级版：@Around 环绕（可拿返回值 + 记录失败）

```java
@Around("logPointCut()")
public Object around(ProceedingJoinPoint pjp) throws Throwable {
    MethodSignature signature = (MethodSignature) pjp.getSignature();
    Method method = signature.getMethod();
    OperateLog operateLog = method.getAnnotation(OperateLog.class);
    Object[] args = pjp.getArgs();

    Object result = null;
    try {
        result = pjp.proceed();
        System.out.println("操作日志【成功】 类型：" + operateLog.type()
                + " 描述：" + operateLog.desc() + " 入参：" + Arrays.toString(args)
                + " 返回：" + result);
    } catch (Throwable e) {
        System.out.println("操作日志【失败】 类型：" + operateLog.type()
                + " 描述：" + operateLog.desc() + " 入参：" + Arrays.toString(args)
                + " 异常：" + e.getMessage());
        throw e; // 不吞异常
    }
    return result;
}
```

## 六、两种切入点方式对比

| 方式 | 切入点表达式 | 匹配依据 | 适用场景 |
| --- | --- | --- | --- |
| execution 表达式 | `execution(* com.xxx.service.*.*(..))` | 方法签名路径（包/类/方法名） | 批量拦截整个包/模块（全局日志、耗时统计） |
| annotation 注解 | `@annotation(com.xxx.annotation.OperateLog)` | 方法上是否标记指定注解 | 按需拦截，粒度可控（操作日志、权限校验） |

> 两者都属于 **Spring AOP（运行期动态代理）**，只是切入点表达式不同，与代理类型无关。

## 七、Spring AOP vs AspectJ

| 维度 | Spring AOP | AspectJ |
| --- | --- | --- |
| 实现方式 | 运行时动态代理（JDK / CGLIB） | 编译期织入 / 加载期织入 |
| 能力 | 只能拦截 Spring Bean 的 public 方法 | 可拦截普通对象、私有方法、构造函数等 |
| 依赖 | 内置，无需额外编译处理 | 完整 AOP 框架 |

> Spring 引入 aspectjweaver 只是借用注解语法，默认仍是 Spring AOP 动态代理。

## 八、JDK 动态代理 vs CGLIB 代理

### 选择规则

1. **目标类实现了接口** → 默认 JDK 动态代理（代理接口）
2. **目标类没有实现接口** → CGLIB 代理（继承目标类生成子类）
3. **SpringBoot 2.x 起默认 `spring.aop.proxy-target-class=true`，优先 CGLIB**（即使有接口）

### 对比

| 特性 | JDK 动态代理 | CGLIB 代理 |
| --- | --- | --- |
| 原理 | 实现目标接口 | 继承目标类，生成子类 |
| 依赖 | JDK 原生，无需额外包 | 需要 cglib（spring-boot-starter-aop 自带） |
| 限制 | 必须有接口，只代理接口方法 | 不能代理 final 类、final 方法 |
| 方法范围 | 接口中 public 方法 | 非 final 的 public/protected 方法 |

### 手动指定

```yaml
# application.yml
spring:
  aop:
    proxy-target-class: true   # true=CGLIB；false=JDK
```

```java
// 或启动类注解
@EnableAspectJAutoProxy(proxyTargetClass = true)
```

### 例子判定

- `UserServiceImpl implements UserService`：默认 SpringBoot 下是 CGLIB；`proxy-target-class=false` 时为 JDK。
- `@RestController` 的 Controller 类一般不实现接口 → 一定是 CGLIB。

## 九、常见坑点

1. **AOP 只能拦截 Spring Bean 的方法**，普通 `new` 出来的对象不会被拦截。
2. **同类内方法调用（this 调用）不走代理对象，AOP 失效**。
3. 注解 / 切面只能作用于 **public 方法**，private 方法拦截不到。
4. Spring AOP 是动态代理（运行时织入），与编译期织入的原生 AspectJ 不同。
5. final 方法：CGLIB 也无法拦截；JDK 代理只认接口方法。

## 十、常见使用场景

1. 接口统一日志记录、入参出参打印
2. 接口性能耗时统计
3. 权限拦截、登录校验
4. 操作日志记录（谁、何时、做了什么）
5. 统一异常处理、数据脱敏
