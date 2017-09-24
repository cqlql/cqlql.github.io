/* eslint-disable */
/**
 * 更基础的拖动
 * 针对pc鼠标事件实现
 *
 * 兼容性：ie9+
 *
 * @param onDown 可通过 return false 阻止拖动发送
 */
export default function drag({
  eDrag, onMove, onDown = () => { }, onUp = () => { }
}) {
  eDrag.addEventListener('mousedown', down);

  function down(e) {

    if (onDown(e) === false) return;

    document.addEventListener('mousemove', mousemove);
    document.addEventListener('mouseup', mouseup);

    function mousemove(e) {
      onMove(e);
    }

    function mouseup() {
      onUp();

      //解除所有事件
      document.removeEventListener('mousemove', mousemove);
      document.removeEventListener('mouseup', mouseup);
    }
  }
}

