/**
 * Created by cql on 2017/4/15.
 */
import 'css-base/dist/preloader.css'
import 'preloader-full/dist/preloader-full.css'
import preloaderFull from 'preloader-full';

// demo1: 没蒙版
function show1() {

  return new Promise(function (resolve, reject) {
    // 显示
    preloaderFull.show();

    setTimeout(function () {
      // 关闭
      preloaderFull.close();

      resolve()
    },1000);
  })
}

// demo2: 有蒙版
function show2() {

  // 显示
  preloaderFull.show({
    mask:true
  });

  setTimeout(function () {
    // 关闭
    preloaderFull.close();

  },1000);
}

let asyncTest = async function () {

  await show1()

  show2()

}

showBtn.addEventListener('click',function () {
  asyncTest()
});


asyncTest()

