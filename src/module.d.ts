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

declare var GM: {
	getValue: (key:string, default_value?:any)=>Promise<any>;
	setValue: (key:string, value:any)=>Promise;
	setClipboard: (data:string)=>void,
	notification: (details:Object, ondone:Function)=>void
}

declare function require(filename:string):any;
declare var module: { exports: any };
declare var imu_variable:any;
declare var imu_xhr:{ custom_xhr: class }; // for custom_xhr_wrap, which is stringified

declare var chrome: {
	permissions: {
		request: Function
	}
}
