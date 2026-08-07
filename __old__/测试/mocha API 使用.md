

## 异步测试

**可利用此方式查看输出到测试浏览器中的对象：** 测试执行完后，测试浏览器输出的对象被销毁，无法查看，可通过此方式暂停运行，查看输出的对象

默认超时时间为2s，超时后自动执行done。超时时间可设置

```js
describe('加法函数的测试', function() {
  it('测试应该5000毫秒后结束', function(done) {
    this.timeout(5000);//设置超时时间为5s
    var x = true;
    var f = function() {
      x = false;
      expect(x).to.be.not.ok;
      done(); // 通知Mocha测试结束
    };
    setTimeout(f, 4000);
  });
});
```

## only

```js
describe('Array', function() {
  describe.only('#indexOf()', function() {
    it.only('should return -1 unless present', function() {
      // ...
    });
  });
});
```