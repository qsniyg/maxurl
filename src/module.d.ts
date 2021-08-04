interface Window {
	ClipboardItem: class
}

declare var unsafeWindow : Window;

interface Clipboard {
	write: Function
}

declare function GM_getValue(key:string, default_value?:any):any;
declare function GM_setValue(key:string, value:any):void;
declare function GM_setClipboard(data:string, options?:any):void;
declare function GM_addValueChangeListener(key:string, cb:Function):void;
declare function GM_notification(details:Object, ondone:Function):void;
declare function GM_xmlhttpRequest(data:Object):void;
declare var GM_info: (Object|Function);
declare var GM_fetch: Function;
declare var GM_registerMenuCommand: Function;
declare var GM_unregisterMenuCommand: Function;
declare var GM_openInTab: Function;
declare var GM_download: Function;

declare var GM: {
	getValue: (key:string, default_value?:any)=>Promise<any>;
	setValue: (key:string, value:any)=>Promise;
	setClipboard: (data:string)=>void,
	notification: (details:Object, ondone:Function)=>void,
	xmlHttpRequest: (data:Object)=>void,
	openInTab: Function
}

declare function require(filename:string):any;
declare var Buffer: {
	from: (...args)=>any;
};
declare var module: { exports: any };

declare var imu_variable:any;
declare var imu_xhr:{ custom_xhr: class }; // for custom_xhr_wrap, which is stringified

declare var chrome: {
	permissions: {
		request: Function
	},
	runtime: {
		getURL: (url:string)=>any;
		getManifest: ()=>any;
		onMessage: {
			addListener: Function
		}
	}
}

declare var userscript_extension_message_handler:Function;
declare var imu_userscript_message_sender:Function;

declare function BigInt(n:number):any;

declare class Map<K,V> {
	set: (key:K, value:V)=>void
	get: (key:K)=>V
	has: (key:K)=>boolean
	delete: (key:K)=>void
	keys: ()=>any
	size: number
}

interface Object {
	assign: (...args)=>any
}

declare class SharedArrayBuffer {
	constructor(n:number)
}
