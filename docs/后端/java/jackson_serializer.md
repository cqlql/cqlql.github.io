

## spring boot 4 中变化

在 spring boot 4 中，`Jackson2JsonRedisSerializer` `GenericJackson2JsonRedisSerializer` 都已经废弃，改用

```
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
```

ObjectMapper 也改了

```
// 旧
import com.fasterxml.jackson.databind.ObjectMapper;
// 新
import tools.jackson.databind.ObjectMapper;
```

## webconfig 配置

控制器参数解析，json、url 参数都支持，比如将字符串值转换成枚举类型：

```java
package com.xiaodingtie.passup.common.enums;

import java.util.stream.Collectors;

import com.xiaodingtie.passup.common.api.ResultCode;
import com.xiaodingtie.passup.common.exception.BusinessException;

public interface BaseEnum<T> {

    T getValue();

    static <E extends Enum<E> & BaseEnum<?>> E from(Class<E> enumClass, Object value) {

        if (value == null) {
            throw new BusinessException(ResultCode.PARAM_INVALID, "枚举值不能为空");
        }

        E[] constants = enumClass.getEnumConstants();

        String input = String.valueOf(value);

        for (E e : constants) {
            @SuppressWarnings("null")
            var enumValue = e.getValue();
            if (String.valueOf(enumValue).equalsIgnoreCase(input)) {
                return e;
            }
        }

        @SuppressWarnings("null")
        String allowedValues = java.util.Arrays.stream(constants)
                .map(e -> String.valueOf(e.getValue()))
                .collect(Collectors.joining(", "));

        throw new BusinessException(
                ResultCode.PARAM_INVALID,
                String.format(
                        "非法枚举值 '%s'，枚举类型: %s，允许值: [%s]",
                        input,
                        enumClass.getSimpleName(),
                        allowedValues));
    }
}
```



```java
package com.xiaodingtie.passup.common.convert;

import org.springframework.core.convert.converter.Converter;
import org.springframework.core.convert.converter.ConverterFactory;

import com.xiaodingtie.passup.common.enums.BaseEnum;

public class BaseEnumConverterFactory implements ConverterFactory<String, BaseEnum<?>> {

    @SuppressWarnings({ "unchecked", "rawtypes" })
    @Override
    public <T extends BaseEnum<?>> Converter<String, T> getConverter(Class<T> targetType) {
        return source -> (T) BaseEnum.from((Class) targetType, source);
    }
}
```



```java
package com.xiaodingtie.passup.infrastructure.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import com.xiaodingtie.passup.common.convert.BaseEnumConverterFactory;

@Configuration // 标记为配置类，会被 Spring 扫描加载
public class WebConfig implements WebMvcConfigurer {
    /**
     * 配置格式化器，将 String 转换为 枚举类型
     * 解决：在控制器中 @RequestHeader 可直接使用 枚举类型
     */
    @Override
    public void addFormatters(FormatterRegistry registry) {
        // 让 Spring 知道如何把 String 转成 枚举类型
        registry.addConverterFactory(new BaseEnumConverterFactory());
    }
}
```



## redisConfig

```java
package com.xiaodingtie.passup.infrastructure.redis;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.JacksonJsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializer;

import com.xiaodingtie.passup.modules.auth.model.UserSession;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, Object> redisTemplate(
            RedisConnectionFactory factory) {

        return buildTemplate(factory, Object.class);
    }

    @Bean
    public RedisTemplate<String, UserSession> userSessionRedisTemplate(
            RedisConnectionFactory factory) {
        return buildTemplate(factory, UserSession.class);
    }

    private <T> RedisTemplate<String, T> buildTemplate(RedisConnectionFactory factory, Class<T> clazz) {
        RedisTemplate<String, T> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        // key 用 String
        template.setKeySerializer(RedisSerializer.string());
        template.setHashKeySerializer(RedisSerializer.string());

        JacksonJsonRedisSerializer<T> valueSerializer = new JacksonJsonRedisSerializer<>(clazz);
        template.setValueSerializer(valueSerializer);
        template.setHashValueSerializer(valueSerializer);

        template.afterPropertiesSet();
        return template;
    }

}
```



## JacksonConfig

目前不知道什么情况下生效，先记着

```java
package com.xiaodingtie.passup.common.jackson;

import java.util.stream.Collectors;

import com.xiaodingtie.passup.common.api.ResultCode;
import com.xiaodingtie.passup.common.enums.BaseEnum;
import com.xiaodingtie.passup.common.exception.BusinessException;

import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.ValueDeserializer;

public class BaseEnumDeserializer extends ValueDeserializer<BaseEnum<?>> {

    @Override
    public BaseEnum<?> deserialize(JsonParser p, DeserializationContext ctxt)
            throws JacksonException {

        String value = p.getValueAsString();
        JavaType type = ctxt.getContextualType();

        Class<?> rawClass = type.getRawClass();

        Object[] constants = rawClass.getEnumConstants();

        for (Object constant : constants) {
            BaseEnum<?> e = (BaseEnum<?>) constant;

            @SuppressWarnings("null")
            var enumValue = e.getValue().toString();
            if (enumValue.equalsIgnoreCase(value)) {
                return e;
            }
        }

        @SuppressWarnings("null")
        String validValues = java.util.Arrays.stream(constants)
                .map(c -> ((BaseEnum<?>) c).getValue().toString())
                .collect(Collectors.joining(", "));

        throw new BusinessException(ResultCode.PARAM_INVALID,
                String.format("字段值 '%s' 不合法，枚举 %s 可选值: [%s]",
                        value,
                        rawClass.getSimpleName(),
                        validValues));
    }
}
```



```java
// 目前只是实现 BaseEnum 的反序列化
// 弃用：Spring Boot 4 / Java 21+ 中 Jackson 对 Record 的原生支持已经非常成熟 。由于 Record 具有标准的规范构造函数（Canonical Constructor），Jackson 可以自动识别并绑定 JSON 字段，无需添加 @JsonCreator

package com.xiaodingtie.passup.common.jackson;

import com.xiaodingtie.passup.common.enums.BaseEnum;

import tools.jackson.databind.module.SimpleModule;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {

    @Bean
    public JsonMapperBuilderCustomizer jsonCustomizer() {
        return builder -> {
            SimpleModule module = new SimpleModule();
            module.addDeserializer(BaseEnum.class, new BaseEnumDeserializer());
            builder.addModule(module);
        };
    }

}

```

