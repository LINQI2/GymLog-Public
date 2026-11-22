/** 最小化的微信小程序全局类型声明（避免引入额外 npm 依赖） */
declare const wx: any;
declare function App(options: any): void;
declare function Page(options: any): void;
declare function Component(options: any): void;
declare function getApp<T = any>(): T;
declare function getCurrentPages(): any[];
declare const __wxConfig: any;

/** 小程序运行时提供的定时器（不引入完整 DOM lib） */
declare function setTimeout(handler: (...args: any[]) => void, timeout?: number): number;
declare function clearTimeout(id: number): void;
declare function setInterval(handler: (...args: any[]) => void, timeout?: number): number;
declare function clearInterval(id: number): void;

declare namespace WechatMiniprogram {
  type IAnyObject = Record<string, any>;
}
