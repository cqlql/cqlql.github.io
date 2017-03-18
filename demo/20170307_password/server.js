/**
 * Created by cql on 2017/3/7.
 */

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
http.createServer(function (req, res) {
    // console.log(req);

    //
    let pathname = url.parse(req.url).pathname;
    let paths = pathname.split('/');

    let extname = path.extname(pathname);


    if (extname.length > 1) {
        //响应静态文件

        handles.file(req, res,pathname);
    }
    else{
        let action = paths[1];

        action = action ? action : 'index';

        let handle = handles[action] || function () {
                res.writeHead(404);
                res.end('找不到相关文件。- -');
            };

        // 处理数据
        if (hasBody(req)) {
            var buffers = [];
            req.on('data', function (chunk) {
                buffers.push(chunk);
            });
            req.on('end', function () {
                req.rawBody = Buffer.concat(buffers).toString();
                handle(req, res);
            });
        } else {
            handle(req, res);
        }

    }



}).listen(3001, '127.0.0.1');
// }).listen(3001, '192.168.1.100');

let hasBody = function(req) {
    return 'transfer-encoding' in req.headers || 'content-length' in req.headers;
};

let handles = {
    index (req, res) {
        fs.readFile('dist/view.html', 'utf8', function (err, text) {

            res.writeHead(200, {'Content-Type': 'text/html'});
            res.end(text);
        });

    },
    list(req, res){
        // console.log(req.rawBody);
        getData(function (data) {

            res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
            res.end(data);
        });

    },
    add(req, res){
        getData(function (datastr) {
            // res.setHeader('Content-Length', 163);
            let data=JSON.parse(datastr);
            let body=JSON.parse(req.rawBody );
            data.push(body);

            reData(data,res);

        });

    },
    edit(req, res){
        getData(function (datastr) {

            let data=JSON.parse(datastr);
            let body=JSON.parse(req.rawBody );
            data[body.index]=body.d;

            reData(data,res);
        });
    },
    del(req, res){
        getData(function (datastr) {

            let data=JSON.parse(datastr);
            let body=JSON.parse(req.rawBody );

            data.splice(body.index,1);

            reData(data,res);
        });
    },
    // 重新生成data.js
    reset(req, res){
        getData(function (datastr) {

            fs.writeFileSync('./dist/data.js', 'var mainData='+datastr,'utf8');

            res.setHeader('Content-Type', 'application/json;charset=utf-8');
            res.writeHead(200);
            res.end(JSON.stringify({
                state:true
            }) );
        });

    },
    file(req, res, pathname){

        fs.readFile(path.join('dist/', pathname), function (err, file) {

            if (err) {
                res.writeHead(404);
                res.end('找不到相关文件。- -');
                return;
            }
            res.writeHead(200);
            res.end(file);
        });
    }

};

function getData(cb) {
    fs.readFile('data.json', 'utf8', function (err, text) {
        cb(text);
    });
}

function  reData(newData,res) {

    var text= JSON.stringify(newData);

    fs.writeFileSync('./dist/data.js', 'var mainData='+text,'utf8');

    fs.writeFile('data.json', text,'utf8', function(err) {
        if(err) throw err;
        res.setHeader('Content-Type', 'application/json;charset=utf-8');
        res.writeHead(200);
        res.end(JSON.stringify({
            state:true
        }) );
    });
}