/**
 * 判断应用升级模块，从url地址下载升级描述文件到本地local路径
 * yanyilin@dcloud.io
 * 
 * 升级文件为JSON格式数据，如下：
{
	"appid":"HelloH5",
    "iOS":{
    	"version":"iOS新版本号，如：1.0.0",
    	"note":"iOS新版本描述信息，多行使用\n分割",
    	"url":"Appstore路径，如：itms-apps://itunes.apple.com/cn/app/hello-h5+/id682211190?l=zh&mt=8"
    },
    "Android":{
    	"version":"Android新版本号，如：1.0.1",
    	"note":"Android新版本描述信息，多行使用\n分割",
    	"url":"apk文件下载地址，如：http://www.dcloud.io/helloh5p/HelloH5.apk"
    }
}
 *
 */
(function(w){
// var server="http://www.dcloud.io/helloh5/update.json",//获取升级描述文件服务器地址
// var server= "http://116.85.19.102:8080/platform-web/conf/update.json",//应用服务器url
var server= "http://47.107.72.129:8080/platform-web/conf/update.json",//测试服务器url
localDir="update",localFile="update.json",//本地保存升级描述目录和文件名
keyUpdate="updateCheck",//取消升级键名
keyAbort="updateAbort",//忽略版本键名
// checkInterval=604800000,//升级检查间隔，单位为ms,7天为7*24*60*60*1000=604800000, 如果每次启动需要检查设置值为0
checkInterval=0,
dir=null;

/**
 * 准备升级操作
 * 创建升级文件保存目录
 */
function initUpdate(){
	// 在流应用模式下不需要检测升级操作
	if(navigator.userAgent.indexOf('StreamApp')>=0){
		return;
	}
	// 打开doc根目录
	plus.io.requestFileSystem( plus.io.PRIVATE_DOC, function(fs){
		fs.root.getDirectory( localDir, {create:true}, function(entry){
			dir = entry;
			checkUpdate();
		}, function(e){
			console.log( "准备升级操作，打开update目录失败："+e.message );
		});
	},function(e){
		console.log( "准备升级操作，打开doc目录失败："+e.message );
	});
	
}

/**
 * 检测程序升级
 */
function checkUpdate() {
	// 判断升级检测是否过期
	var lastcheck = plus.storage.getItem( keyUpdate );
	if ( lastcheck ) {
		var dc = parseInt( lastcheck );
		var dn = (new Date()).getTime();
		if ( dn-dc < checkInterval ) {	// 未超过上次升级检测间隔，不需要进行升级检查
			return;
		}
		// 取消已过期，删除取消标记
		plus.storage.removeItem( keyUpdate );
	}
	// 读取本地升级文件
	dir.getFile( localFile, {create:false}, function(fentry){
		fentry.file( function(file){
			var reader = new plus.io.FileReader();
			reader.onloadend = function ( e ) {
				fentry.remove();
				var data = null;
				try{
					data=JSON.parse(e.target.result);
				}catch(e){
					console.log( "读取本地升级文件，数据格式错误！" );
					return;
				}
				
				checkUpdateData( data );
			}
			reader.readAsText(file);
		}, function(e){
			console.log( "读取本地升级文件，获取文件对象失败："+e.message );
			fentry.remove();
		});
	}, function(e){
		// 失败表示文件不存在，从服务器获取升级数据
		getUpdateData();
	});
}

/**
 * 检查升级数据
 */
function checkUpdateData( j ){
	var updateModalState = localStorage.getItem('updatemodalstate');
	if(updateModalState === '2'){
		return;
	}

	var curVer=plus.runtime.version;
	var inf = j[plus.os.name];
	// var curVer = '1.2.1';
	
	if (inf){ 
		var srvVer = inf.version;
		// 判断是否存在忽略版本号
		var vabort = plus.storage.getItem( keyAbort );
		if ( vabort && srvVer==vabort ) {
			// 忽略此版本
			return;
		}
		
		// 判断是否需要升级
		if ( compareVersion(curVer,srvVer) ) {
			//提示升级弹框
			var updateContent = inf.note.split('\n');
			var updateHtml = '';
			if(updateContent.length != 0){
				for(var i=0;i<updateContent.length-1;i++){
					updateHtml += '<p>'+ updateContent[i] +'</p>';
				}
			}else{
				updateHtml = '<p>有新版本上线,请下载更新</p>';
			}
			
			$('#updateModalBody').html(updateHtml);
			$('#updateModalTitle').text(inf.title);
			$('#updateModal').show();
			
			localStorage.setItem('updatemodalstate',1);//set update modal prevent show

			localStorage.setItem('execute',false);//set continue execute next task ,show task alert
			
			$('#updateBtn').click(function(){
				//点击更新按钮，设置重新启动任务
				localStorage.setItem('taskstate',false);
				localStorage.setItem('privatestate',false);
				localStorage.setItem('protocolstate',false);
				localStorage.setItem('ringstate',true);//set received task ring
				
				var downLoadUrl = setTimeout(function(){
						plus.runtime.openURL( inf.url );
						$('#updateModal').hide();
						clearTimeout(downLoadUrl);
					},600);
			});
			
		}
	}
}

/**
 * 从服务器获取升级数据
 */
function getUpdateData(){
	var xhr = new plus.net.XMLHttpRequest();
	xhr.onreadystatechange = function () {
        switch ( xhr.readyState ) {
            case 4:
                if ( xhr.status == 200 ) {
                	// 保存到本地文件中
                	dir.getFile( localFile, {create:true}, function(fentry){
                		fentry.createWriter( function(writer){
                			writer.onerror = function(){
                				console.log( "获取升级数据，保存文件失败！" );
                			}
                			writer.write( xhr.responseText );
                		}, function(e){
                			console.log( "获取升级数据，创建写文件对象失败："+e.message );
                		} );
                	}, function(e){
                		console.log( "获取升级数据，打开保存文件失败："+e.message );
                	});
                } else {
                	alert( "获取升级数据，联网请求失败："+xhr.status );
                }
                break;
            default :
                break;
        }
	}
	xhr.open( "GET", server );
	xhr.send();
}

/**
 * 比较版本大小，如果新版本nv大于旧版本ov则返回true，否则返回false
 * @param {String} ov
 * @param {String} nv
 * @return {Boolean} 
 */
function compareVersion( ov, nv ){
	if ( !ov || !nv || ov=="" || nv=="" ){
		return false;
	}
	var b=false,
	ova = ov.split(".",4),
	nva = nv.split(".",4);
	for ( var i=0; i<ova.length&&i<nva.length; i++ ) {
		var so=ova[i],no=parseInt(so),sn=nva[i],nn=parseInt(sn);
		if( nn>no || sn.length>so.length  ){
			return true;
		}else if( nn<no ){
			return false;
		}
	}
	if ( nva.length>ova.length && 0==nv.indexOf(ov) ) {
		return true;
	}
}

if ( w.plus ) {
	initUpdate();
} else {
	document.addEventListener("plusready", initUpdate, false );
}

})(window);