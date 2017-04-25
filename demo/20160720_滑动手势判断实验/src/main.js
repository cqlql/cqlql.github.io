/**
 * Created by cql on 2017/4/21.
 */


import dragBase from 'drag-Base-Mobile';



let startX,
    startY,
    onlyOne=1;

dragBase({
    eDrag:document,
    onMove (e) {

        if(onlyOne){
            let touche=e.touches[0];
            let moveX=touche.pageX,moveY=touche.pageY;

            let
                xlen=moveX-startX,
                ylen=moveY-startY;


           if( Math.abs(Math.atan(ylen / xlen)>1.2)){


            }

            // 当前角度
            // console.log(Math.atan(ylen / xlen)*180 / Math.PI);



            onlyOne=0;
        }

    },
    onDown(e){

    },
    onStart(e){
        let touche=e.touches[0];
        // Math.atan(ylen / xlen)

        startX=touche.pageX;
        startY=touche.pageY;

        onlyOne=1;

    },
    onEnd(e){


    }
});


