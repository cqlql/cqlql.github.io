"use strict";


test1(document.getElementById('cvs1'));
// test1(document.getElementById('cvs2'));

function test1(canvas) {

	// var canvas = document.getElementById('cvs1');

	var ctx = canvas.getContext('2d');

	// canvas.addEventListener('mousemove', function (e) {
	//           console.log(e.layerX);
	// });

	var clickX, clickY, locX, locY;
	var preX, preY, currX, currY;

	var radius = 8;
	c.drag(canvas, function(e) {
		e = e.event;
		preX = currX;
		preY = currY;

		currX = e.offsetX;
		currY = e.offsetY;

		var context = ctx;

		context.beginPath();

		context.moveTo(preX, preY);
		context.lineTo(currX, currY);
		context.closePath();

		context.lineJoin = "round";
		context.lineWidth = radius;

		context.strokeStyle = 'red';
		context.stroke();


		// ctx.beginPath();
		// ctx.arc(locX, locY, 20, 0, 2 * Math.PI);
		// ctx.closePath();
		// ctx.stroke();
		// ctx.fill();
	}, function(e) {

		currX = preX = e.offsetX;
		currY = preY = e.offsetY;
	}, function() {

	});

	toCanves();


	function toCanves() {
		var html = (new XMLSerializer).serializeToString(document.getElementById('test'));

		var data = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">' +
			'<foreignObject width="100%" height="100%">' + html +
			'</foreignObject>' + '</svg>';

		var DOMURL = window.URL || window.webkitURL || window;

		var img = new Image();
		
		var svg = new Blob([data], {
			type: 'image/svg+xml;charset=utf-8'
		});
		var url = DOMURL.createObjectURL(svg);

		img.onload = function() {
			ctx.drawImage(img, 0, 0);
			// DOMURL.revokeObjectURL(url);
			console.log(canvas);

			console.log(canvas.toDataURL("image/png"));

		}
		// img.setAttribute('crossOrigin', 'anonymous');
		img.crossOrigin = "*";
		console.log(url);
		document.body.appendChild(img);
		img.src = url;
	}
}

function merge() {
	document.getElementById('cvs1').getContext("2d").drawImage(document.getElementById('cvs2'), 0, 0);

}

function toImg(canvas) {
	canvas=document.getElementById('cvs1');
	// console.log(canvas.toDataURL());
	document.getElementById('img1').src=canvas.toDataURL();


}

function toCanves() {
	var html = (new XMLSerializer).serializeToString(document.getElementById('test'));

	var data = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200">' +
		'<foreignObject width="100%" height="100%">' + html +
		'</foreignObject>' + '</svg>';

	var DOMURL = window.URL || window.webkitURL || window;

	var img = new Image();
	var svg = new Blob([data], {
		type: 'image/svg+xml;charset=utf-8'
	});
	var url = DOMURL.createObjectURL(svg);
	console.log(url);
	img.onload = function() {
		ctx.drawImage(img, 0, 0);
		DOMURL.revokeObjectURL(url);
	}

	img.src = url;
}