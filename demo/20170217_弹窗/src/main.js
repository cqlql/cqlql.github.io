/**
 * Created by cql on 2017/2/17.
 */


require('./main.pcss');

import click from 'click';
import Popup from 'popup';

let popup = new Popup();

let popupbtn = document.querySelector('a');

click(popupbtn,e=>{
    popup.show({
        content: 'xxxxxxxxxx'
    });
});
