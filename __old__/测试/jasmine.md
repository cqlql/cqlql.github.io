## beforeEach、beforeAll

```js
var i = 0;
describe("test-foo", function () {
  // 每次 it 都会执行
  // 只限于当前 describe
  beforeEach(function () {
    console.log("beforeEach", i++);
  });

  // 只执行一次
  beforeAll(function () {
    console.log("beforeAll");
  });

  it("it1", function () {});

  it("it2", function () {});
});

describe("test-bar", function () {
  it("it3", function () {});
});
```

## 只执行指定的 describe、it

前面加 f 即可：`fdescribe`、`fit`
