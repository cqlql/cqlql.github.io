/*function inertiaAnime(change, rate) {

  var o = this,

    //开关。 是否进行中。true 进行中
    sw = false;

  rate = rate ? rate : .2;

  function lastExcu() {

    sw = false;
  }

  // 参数2 可以是任意值，12px这种也是有效的，其他非数字将视为0
  function start(to, cur) {

    function baseExcu() {
      if (sw) {
        var len = rate * (o.to - o.cur);

        o.cur += len;

        //最后一次
        if (Math.abs(o.to - o.cur) < 1) {
          o.cur = o.to;

          lastExcu();
        }

        change(o.cur);

        window.requestAnimationFrame(baseExcu);
      }
    }

    o.to = to;
    cur = parseFloat(cur);
    o.cur = cur ? cur : o.cur;

    if (sw) return;
    sw = true;

    window.requestAnimationFrame(baseExcu);
  }

  function stop() {
    sw = false;
  }

  this.start = start;
  this.stop = stop;
  this.cur = 0;
  this.to = 0;

  this.getState = function () {
    return sw;
  };
}*/

export default class {
  constructor({move=()=>{},rate=.2,complete=()=>{}}) {

    this.rate = rate;
    this.move = move

    //开关。 是否进行中。true 进行中
    this.sw = false;

    this.cur = 0;

    this.complete = complete

  }

  start(to, cur=this.cur) {
    let {sw,rate,move} = this

    this.to = to
    this.cur = cur
    this.stopId

    if (sw) return;
    sw = true;

    let excu = () => {

      if (sw) {
        let {to,cur} = this

        this.cur = cur = cur + rate * (to - cur);

        //最后一次
        if (Math.abs(to - cur) < 1) {
          this.cur = to;
          sw = false;
          this.complete()
        }

        move(cur);

        this.stopId = window.requestAnimationFrame(excu);
      }
    }

    this.stopId = window.requestAnimationFrame(excu);
  }

  stop() {
    this.sw = false;
    window.cancelAnimationFrame(this.stopId)
  }
}
