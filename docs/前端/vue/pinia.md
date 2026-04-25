

## 动态注册和销毁

### 注册
第一次 use 就会被注册，销毁后再次 use 也会重新注册

### 销毁
使用 store.$dispose

注意，并不会真正销毁，当再次 use 后数据也会再次恢复过来。


### 代码示例

```ts
import { defineStore } from 'pinia';

let useFormDesignEditStoreReal: ReturnType<typeof createUseStore> | undefined;

function createUseStore() {
  const useStore = defineStore('formDesignEditStore', {
    state: () => {
      return { count: 0 };
    },
  });

  return useStore;
}

// 注册和销毁
export function useFormDesignEditStoreInstall() {
  const store = useFormDesignEditStore();
  onUnmounted(() => {
    store.$reset();
    store.$dispose();
    useFormDesignEditStoreReal = undefined;
  });
}

// 使用
export function useFormDesignEditStore() {
  if (!useFormDesignEditStoreReal) {
    useFormDesignEditStoreReal = createUseStore();
  }

  return useFormDesignEditStoreReal();
}

/********** 使用 */

// 目标范围根组件执行，注册和销毁
useFormDesignEditStoreInstall();

// 使用 store
const store = useFormDesignEditStore()

```
