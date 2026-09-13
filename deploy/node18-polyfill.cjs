// Node 18.15 运行时补丁。部署目标（腾讯云函数）最高只给到 Node 18.15，
// 而 Next 15 的服务端路径依赖两个更晚才有的能力。
const { AsyncLocalStorage, AsyncResource } = require("async_hooks");

// 1) AsyncLocalStorage.snapshot —— Node 18.16 才加入。
//    语义：捕获当前异步上下文，返回的函数无论何时调用都在该上下文中执行。
if (typeof AsyncLocalStorage.snapshot !== "function") {
  AsyncLocalStorage.snapshot = function snapshot() {
    return AsyncResource.bind((cb, ...args) => cb(...args));
  };
}

// 2) File 全局 —— Node 20 才加入。Next 解析 multipart 表单时会引用它，
//    缺了会在 request.formData() 内部抛 ReferenceError: File is not defined。
//    undici 自带实现，直接借用。
if (typeof globalThis.File === "undefined") {
  try {
    const { File } = require("buffer");
    if (File) globalThis.File = File;
  } catch {}
  if (typeof globalThis.File === "undefined") {
    try {
      globalThis.File = require("undici").File;
    } catch {}
  }
}
