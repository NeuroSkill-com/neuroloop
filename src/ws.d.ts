declare module "ws" {
	import { EventEmitter } from "events";
	class WebSocket extends EventEmitter {
		static readonly CONNECTING: 0;
		static readonly OPEN: 1;
		static readonly CLOSING: 2;
		static readonly CLOSED: 3;
		readonly readyState: 0 | 1 | 2 | 3;
		constructor(url: string, options?: object);
		send(data: string): void;
		close(code?: number, reason?: string): void;
		on(event: "open",    listener: () => void): this;
		on(event: "close",   listener: (code: number, reason: Buffer) => void): this;
		on(event: "error",   listener: (err: Error) => void): this;
		on(event: "message", listener: (data: Buffer | ArrayBuffer | string) => void): this;
	}
	export = WebSocket;
}
