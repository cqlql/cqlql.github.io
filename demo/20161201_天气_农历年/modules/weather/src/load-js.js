


export default function ({src,callback=function () {},charset='utf-8',}) {

  let script = document.createElement('script');

  script.type = "text/javascript";
  script.charset = charset;
  script.src = src;
  script.onload = function () {
    callback();
    script.remove()
  };

  document.head.appendChild(script);
}
