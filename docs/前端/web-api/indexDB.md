## 事务

必须等上一个事务完成，才能进行下一个事务。

### 是否有事务在进行

```typescript
if (request.transaction) {
  request.transaction.addEventListener('complete', complete);
} else {
  complete();
}
```



## 基本使用

封装

```typescript
export class IndexedDBHelper {
  private request?: IDBOpenDBRequest;
  private db?: IDBDatabase;
  // 在 request 未就绪前添加到队列，就绪后执行所有队列
  private queue = new QueueWait<IDBOpenDBRequest>();
  constructor(
    dbName = 'MyTestDatabase',
    version = 1,
    onUpgrade?: (request: IDBOpenDBRequest, event: IDBVersionChangeEvent) => void,
  ) {
    getIndexedDB(dbName, version, onUpgrade).then((request) => {
      this.request = request;
      this.db = request.result;
      this.queue.exec(request);
    });
  }

  async getDB() {
    await this.getRequest();
    return this.db!;
  }

  async getRequest() {
    return new Promise<IDBOpenDBRequest>((resolve) => {
      if (this.request) {
        safeDBOperation(this.request).then(resolve);
      } else {
        this.queue.add((request) => {
          safeDBOperation(request).then(resolve);
        });
      }
    });
  }
}

function getIndexedDB(
  dbName = 'MyTestDatabase',
  version = 1,
  onUpgrade?: (request: IDBOpenDBRequest, event: IDBVersionChangeEvent) => void,
) {
  return new Promise<IDBOpenDBRequest>((resolve, reject) => {
    const request = indexedDB.open(dbName, version);

    request.onerror = () => {
      console.error('=====', '为什么不允许我的 web 应用使用 IndexedDB！', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onerror = (ev: any) => {
        console.error('=====', `数据库错误：${ev.target.error}`);
      };
      resolve(request);
    };

    request.onupgradeneeded = async (event) => {
      onUpgrade?.(request, event);

      resolve(request);
    };
  });
}

/**
 * 安全操作
 * 在上一个事务结束后，才能进行下一个事务操作
 */
function safeDBOperation(request: IDBOpenDBRequest) {
  return new Promise<IDBOpenDBRequest>((resolve) => {
    // 是否有事务在进行
    if (request.transaction) {
      request.transaction.addEventListener('complete', () => resolve(request));
    } else {
      resolve(request);
    }
  });
}

class QueueWait<T = any> {
  private q: ((data: T) => void)[] = [];
  add(cb: (data: T) => void) {
    this.q.push(cb);
  }
  // 执行所有的队列
  exec(data: T) {
    const fn = this.q.shift();
    if (fn === undefined) return;
    fn(data);
    this.exec(data);
  }
  clear() {
    this.q = [];
  }
}
```

基本使用

```vue
<script lang="ts" setup>
  import { IndexedDBHelper } from '../../utils/indexedDBHelper.ts';

  const dbName = 'MyTestDatabase';
  const version = 2;

  interface Customer {
    ssn: string;
    name: string;
    age: number;
    email: string;
  }

  class IndexedDBTest extends IndexedDBHelper {
    constructor() {
      super(dbName, version, (request, ev) => {
        const db = request.result;
        switch (ev.oldVersion) {
          case 0:
            // 创建新的
            toNewVersion(db);
          case 1:
            // 1升级到2
            toNewVersion2(db);
        }
      });
    }

    getObjectStore() {
      return new Promise<IDBObjectStore>((resolve) => {
        super.getDB().then((db) => {
          const transaction = db.transaction(['customers'], 'readwrite');
          const objectStore = transaction.objectStore('customers');
          resolve(objectStore);
        });
      });
    }

    async getVal(id: string) {
      return this.getObjectStore().then((objectStore) => {
        return new Promise<Customer>((resolve, reject) => {
          objectStore.get(id).onsuccess = (event) => {
            const res = (event.target as IDBRequest<Customer> | undefined)?.result;
            if (res) {
              resolve(res);
            } else {
              reject(new Error(`未找到${id}相关历史数据`));
            }
          };
        });
      });
    }
  }

  const indexedDBTest = new IndexedDBTest();

  // 我们的客户数据看起来像这样。
  const customerData: Customer[] = [
    { ssn: '444-44-4444', name: 'Bill', age: 35, email: 'bill@company.com' },
    { ssn: '555-55-5555', name: 'Donna', age: 32, email: 'donna@home.org' },
  ];

  // 创建新的
  function toNewVersion(db: IDBDatabase) {
    // 创建一个对象存储来存储我们客户的相关信息，我们将“ssn”作为主键，主键是不允许重复的
    const objectStore = db.createObjectStore('customers', { keyPath: 'ssn' });

    // 创建一个索引以通过姓名来搜索客户。名字可能会重复，所以我们不能使用 unique 索引。
    objectStore.createIndex('name', 'name', { unique: false });

    // 使用邮箱建立索引，我们想确保客户的邮箱不会重复，所以我们使用 unique 索引。
    objectStore.createIndex('email', 'email', { unique: true });

    // 使用事务的 oncomplete 事件确保在插入数据前对象存储已经创建完毕。
    objectStore.transaction.addEventListener('complete', (event) => {
      const transaction = db.transaction(['customers'], 'readwrite');

      const objectStore = transaction.objectStore('customers');

      customerData.forEach((customer) => {
        const request = objectStore.add(customer);
        request.onsuccess = (event) => {
          console.log('🚀 -- customerData.forEach -- request.onsuccess:', event);
          // event.target.result === customer.ssn;
        };
      });
      // 在所有数据添加完毕后的处理
      transaction.addEventListener('complete', (event) => {
        console.log('customers 全部完成了！', event);
      });
    });
  }

  // 1升级到2
  function toNewVersion2(db: IDBDatabase) {
    const objectStore = db.createObjectStore('names', { autoIncrement: true });
    objectStore.transaction.addEventListener('complete', (event) => {
      const transaction = db.transaction(['names'], 'readwrite');
      const objectStore = transaction.objectStore('names');
      customerData.forEach((customer) => {
        objectStore.add(customer.name);
                        });
    // 在所有数据添加完毕后的处理
    transaction.addEventListener('complete', (event) => {
      console.log('names 全部完成了！', event);
    });
  });
}

// 新增数据
function addData() {
  indexedDBTest.getObjectStore().then((objectStore) => {
    const customer: Customer = {
      ssn: randomNumber(10).toString(),
      name: randomString(5),
      age: randomNumber(2),
      email: randomString(10) + '@company.com',
    };
    const request = objectStore.add(customer);
    request.onsuccess = (event) => {
      console.log('🚀 === 新增成功:', event);
    };
  });
}

// 删除数据
function delData() {
  indexedDBTest.getObjectStore().then((objectStore) => {
    const request = objectStore.delete('444-44-4444');
    request.onsuccess = (event) => {
      console.log('🚀 === 删除成功:', event);
    };
  });
}

// 清空存储库
function clearData() {
  indexedDBTest.getObjectStore().then((objectStore) => {
    const request = objectStore.clear();
    request.onsuccess = (event) => {
      console.log('🚀 === 清空成功:', event);
    };
  });
}

function randomNumber(num: number) {
  return Math.floor(Math.random() * Math.pow(10, num));
}

function randomString(num: number) {
  return Math.random().toString(36).substring(2, num);
}

// 修改年龄
function updateAge() {
  indexedDBTest.getObjectStore().then((objectStore) => {
    const newReq = objectStore.get('444-44-4444');
    newReq.onsuccess = () => {
      const data = newReq.result;
      if (data) {
        // 对 request.result 做些操作！
        console.log('修改前年龄', data.age);
        data.age = 40;
        // 把更新过的对象放回数据库。
        const requestUpdate = objectStore.put(data);
        requestUpdate.onerror = () => {
          // 对错误进行处理
        };
        requestUpdate.onsuccess = () => {
          // 成功，数据已更新！
        };
      }
    };
  });
}

// 查询--使用游标
function uCursor() {
  indexedDBTest.getObjectStore().then((objectStore) => {
    const customers: any[] = [];
    objectStore.openCursor().onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue> | undefined)?.result;

      if (cursor) {
        customers.push(cursor.value);
        cursor.continue();
      } else {
        console.log(`已获取的所有客户：`, customers);
      }
    };
  });
}
// 查询--使用主键
function uKey() {
  indexedDBTest.getVal('555-55-5555').then((data) => console.log(`Donna 的 SSN 是 ${data.ssn}`));
}
// 查询--使用索引
function uIndex() {
  indexedDBTest.getRequest().then((request) => {
    const db = request.result;
    const objectStore = db.transaction('customers').objectStore('customers');

    const index = objectStore.index('name');

    index.get('Donna').onsuccess = (event) => {
      const data = (event.target as IDBRequest<Customer> | undefined)?.result;
      console.log(`Donna 的 SSN 是 ${data?.ssn}`);
    };
  });
}
</script>
<template>
  <div class="DemoIndexBD">
    <el-button @click="addData">新增</el-button>
    <el-button @click="updateAge">修改年龄</el-button>
    <el-button @click="delData">删除</el-button>
    <el-button @click="clearData">清空</el-button>
    <el-button @click="uCursor">使用游标遍历所有</el-button>
    <el-button @click="uKey">使用主键</el-button>
    <el-button @click="uIndex">使用索引</el-button>
  </div>
</template>

<style lang="scss" scoped>
.DemoIndexBD {
  display: flex;
  gap: 8px;
  padding: 22px;
}
</style>
```

## 游标

### 范围

```typescript
// 仅匹配“Donna”
const singleKeyRange = IDBKeyRange.only("Donna");

// 匹配所有大于“Bill”的，包括“Bill”
const lowerBoundKeyRange = IDBKeyRange.lowerBound("Bill");

// 匹配所有大于“Bill”的，但不包括“Bill”
const lowerBoundOpenKeyRange = IDBKeyRange.lowerBound("Bill", true);

// 匹配所有小于“Donna”的，不包括“Donna”
const upperBoundOpenKeyRange = IDBKeyRange.upperBound("Donna", true);

// 匹配所有在“Bill”和“Donna”之间的，但不包括“Donna”
const boundKeyRange = IDBKeyRange.bound("Bill", "Donna", false, true);

// 使用其中的一个键范围，把它作为 openCursor()/openKeyCursor() 的第一个参数
index.openCursor(boundKeyRange).onsuccess = (event) => {
  const cursor = event.target.result;
  if (cursor) {
    // 对匹配结果进行一些操作。
    cursor.continue();
  }
};
```

### 降序

第一个参数是范围，null 表示仅仅想要降序

```typescript
objectStore.openCursor(null, "prev").onsuccess = (event) => {
  const cursor = event.target.result;
  if (cursor) {
    // 对记录进行一些操作。
    cursor.continue();
  }
};
```

### 分页查询

主要使用`IDBObjectStore.count`、`IDBCursor.advance`实现

## 参考文档

[使用 IndexedDB - Web API | MDN](https://developer.mozilla.org/zh-CN/docs/Web/API/IndexedDB_API/Using_IndexedDB#增加、读取和删除数据)

[indexedDB复合搜索、范围搜索和分页查询](https://www.jianshu.com/p/849924a1481c)