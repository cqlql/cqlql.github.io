
```ts

function getRolePermission<T extends Object>(conf: T) {
  const result: {
    [k in keyof T | 'isSuperAdmin']?: boolean;
  } = {
    isSuperAdmin: false,
  };
  return result;
}

const permit = getRolePermission({
  canGet: 'get',
});


console.log(permit.canGet); // type boolean
console.log(permit.isSuperAdmin);
```
