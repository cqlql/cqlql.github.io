
/**
 * 定时器
 * */
export default class Timer {


  constructor({
                callBack,
                time = 3000
              }) {


    this.time = time;
    this.callBack = callBack;
    this.stopId = null;
  }


  // 停止情况调用无效
  start() {
    this.stop();

    let loop = () => {
      this.stopId = setTimeout( ()=> {
        this.callBack();
        loop();
      }, this.time);
    };

    loop();
  }

  stop() {
    clearTimeout(this.stopId);
  }
}
