/**
 * QuickWeb Master
 *
 * @author 老雷<leizongmin@gmail.com>
 * @version 0.3.0
 */
 
var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');
var quickweb = require('quickweb');
var tool = quickweb.import('tool');
var cluster = quickweb.Cluster;


var debug;
if (process.env.QUICKWEB_DEBUG && /master/.test(process.env.QUICKWEB_DEBUG))
  debug = function(x) { console.error('master: %s', x); };
else
  debug = function() { };


// global.QuickWeb.master.applist         应用列表 
// global.QuickWeb.master.config          服务器配置信息 
// global.QuickWeb.master.pushExceptions  记录进程异常信息
// global.QuickWeb.master.workerException 进程异常数组
// global.QuickWeb.master.workerStatus    进程请求统计信息
// global.QuickWeb.master.connector       管理服务器Connector对象
// global.QuickWeb.master.path            服务器路径
// global.QuickWeb.master.checkAuth       验证管理权限


// 设置全局变量
global.QuickWeb.master = {applist: {}}


// 载入服务器配置
var serverConfig = tool.requireFile(path.resolve('./config.js'));
global.QuickWeb.master.config = serverConfig;

  
// Worker进程异常信息
var exceptions = global.QuickWeb.master.workerException = [];

// 记录的进程异常信息数量 默认50条
if (isNaN(serverConfig['exception log size']))
  serverConfig['exception log size'] = 50;

// 记录异常信息
var pushExceptions = function (pid, err) {
  exceptions.push({ pid:        pid
                  , timestamp:  new Date().getTime()
                  , error:      err
                  });
  if (exceptions.length > serverConfig['exception log size'])
    exceptions.shift();
}
global.QuickWeb.master.pushExceptions = pushExceptions;

// Worker进程请求统计信息
var workerStatus = global.QuickWeb.master.workerStatus = {}

 


// ----------------------------------------------------------------------------
// 启动管理服务器
var connector = quickweb.Connector.create();
global.QuickWeb.master.connector = connector;

var server = http.createServer(connector.listener());
server.listen(serverConfig.master.port, serverConfig.master.host);
debug('listen master server: ' + serverConfig.master.host + ':'
      + serverConfig.master.port);

var masterPath = path.resolve(__dirname);
global.QuickWeb.master.path = masterPath;

connector.addApp('default', {appdir: masterPath});

// 载入code目录里面的所有js文件
var codefiles = tool.listdir(masterPath + '/code', '.js').file;
for (var i in codefiles) {
  var m = tool.requireFile(codefiles[i]);
  connector.addCode('default', m);
}

// 载入html目录里面的所有文件
var htmlfiles = tool.listdir(masterPath + '/html').file;
for (var i in htmlfiles) {
  var file = tool.relativePath(masterPath + '/html', htmlfiles[i]);
  connector.addFile('default', file);
}

// 管理权限验证
var checkAuth = function (info) {
  if (!info)
    return false;
    
  // 如果没有设置密码，则直接返回true
  if (!(serverConfig.master && serverConfig.master.admin
      && serverConfig.master.password))
    return true;
    
  if (info.username == serverConfig.master.admin
      && info.password == serverConfig.master.password)
    return true;
  else
    return false;
}
global.QuickWeb.master.checkAuth = checkAuth;


// ----------------------------------------------------------------------------
// 启动Worker进程
if (isNaN(serverConfig.cluster) || serverConfig.cluster < 1)
    serverConfig.cluster = os.cpus().length;
for (var i = 0; i < serverConfig.cluster; i++)
  cluster.fork(true);
  
// 消息处理
require('./message');  
  

// ----------------------------------------------------------------------------
// 进程异常  
process.on('uncaughtException', function (err) {
  debug(err.stack);
  pushExceptions(process.pid, err.stack);
});