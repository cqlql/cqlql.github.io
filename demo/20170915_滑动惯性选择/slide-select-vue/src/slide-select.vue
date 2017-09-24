<template>
  <div class="popup-buttom show">
    <div class="fgp-bg"></div>
    <div class="fgp-bd">
      <div class="fgp-cont">
        <div class="slide-select">
          <div class="s-bar">
            <a class="cl-btn">取消</a>
            <a class="cfm-btn">确认</a>
          </div>
          <div class="s-tit">
            <div v-for="n of names" class="s-t">{{n}}</div>
          </div>
          <div class="s-main">
            <div v-for="ls of list" class="s-list">
              <div class="s-sel">
                <div class="s-mask s-t-mask"></div>
                <div class="s-mask s-b-mask"></div>
                <ul class="s-move">
                  <li v-for="v of ls" class="s-item">{{v}}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
  export default {
    data () {
      return {
        names: ['开始时间', '结束时间'],
        list: [
          [2016, 2015, 1025, 11, 22, 33, 44, 55, 66],
          [2016, 2015, 1025, 11, 22, 33, 44, 55, 66]
        ]
      }
    }
  }
</script>

<style scoped>
  .popup-buttom {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 8;

    .fgp-bg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: #000;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .fgp-bd {
      width: 100%;
      position: absolute;
      /*top: 50%;*/
      bottom: 0;
      left: 0;
      /*left: 50%;*/
      background-color: #fff;

      transition:transform 0.3s ease;
      transform: translateY(100%);

      max-height: 80%;
      overflow: auto;
    }

    .fgp-cont {
      height: 380px;
    }

    &.show {
      pointer-events: auto;
      .fgp-bg {
        opacity: .4;
      }
      .fgp-bd{
        transform: translateY(0);
      }
    }

  }

  .slide-select{
    background-color: #eee;

    .s-bar{
      height: 30px;
      padding: 6px;
      border-bottom: 1px solid #ccc;

      a{
        font-weight: 400;
        line-height: 1.42;
        position: relative;
        display: inline-block;
        margin-bottom: 0;
        cursor: pointer;
        text-align: center;
        vertical-align: top;
        white-space: nowrap;
        color: #333;
        border: 1px solid #ccc;
        border-radius: 3px;
        background-color: #fff;
        background-clip: padding-box;
        font-size: 14px;
        padding: 5px 10px;
      }

      .cl-btn{

      }
      .cfm-btn{
        float: right;

        color: #fff;
        border: 1px solid #007aff;
        background-color: #007aff;
      }
    }

    .s-tit{
      display: flex;
      text-align: center;
      .s-t{
        flex: 1;
      }
    }

    .s-main{
      display: flex;
      height:200px;
    }
    .s-list{
      flex:1;
      margin: 0 10px;
      position: relative;
      overflow: hidden;
    }


    .s-sel{
      height: 30px;
      border-bottom: 1px solid #407bff;
      border-top: 1px solid #407bff;
      position: absolute;
      top: 50%;
      width: 100%;
      transform: translateY(-50%);
    }
    .s-move{
      list-style: none;
      padding: 0;
      margin: 0;
      text-align: center;
      font-size: 16px;
      line-height: 1.8;
    }
    .s-item{
      height: 30px;

    }

    .s-mask{
      position: absolute;
      height: 88px;
      left: 0;
      right: 0;
      background-color: rgba(238, 238, 238, 0.75);
      z-index: 1;
      pointer-events:none;
    }
    .s-t-mask{
      top: 0;
      transform: translateY(-100%);
      box-shadow: inset 0px 20px 20px 0px #eee;
    }
    .s-b-mask{
      bottom: 0;
      transform: translateY(100%);
      box-shadow: inset 0px -20px 20px 0px #eee;
    }
  }

</style>
