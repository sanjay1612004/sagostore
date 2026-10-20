import { EventEmitter } from "node:events";
import { describe, it, expect, vi } from "vitest";

const load = () =>
  vi.importActual<{
    startDevServices: (options: {
      spawnProcess: (
        ...args: unknown[]
      ) => EventEmitter & { kill: ReturnType<typeof vi.fn> };
      onExit: (code: number) => void;
    }) => { stop: () => void };
  }>("../../scripts/dev-services.mjs");
const fakeChild = () => Object.assign(new EventEmitter(), { kill: vi.fn() });
describe("development API and speech startup", () => {
  it("starts both services, closes the survivor on failure, and reports the exit after cleanup", async () => {
    const api = fakeChild(),
      worker = fakeChild(),
      onExit = vi.fn();
    const spawnProcess = vi
      .fn()
      .mockReturnValueOnce(api)
      .mockReturnValueOnce(worker);
    const { startDevServices } = await load();
    startDevServices({ spawnProcess, onExit });
    expect(spawnProcess.mock.calls.map((call) => call[1].at(-1))).toEqual([
      "src/server.ts",
      "src/workers/voice.ts",
    ]);
    worker.emit("exit", 2);
    expect(api.kill).toHaveBeenCalledWith("SIGTERM");
    expect(onExit).not.toHaveBeenCalled();
    api.emit("exit", 0);
    expect(onExit).toHaveBeenCalledExactlyOnceWith(2);
  });
  it("stops both services when the development task is closed", async () => {
    const api = fakeChild(),
      worker = fakeChild(),
      onExit = vi.fn();
    const { startDevServices } = await load();
    const services = startDevServices({
      spawnProcess: vi
        .fn()
        .mockReturnValueOnce(api)
        .mockReturnValueOnce(worker),
      onExit,
    });
    services.stop();
    services.stop();
    expect(api.kill).toHaveBeenCalledOnce();
    expect(worker.kill).toHaveBeenCalledOnce();
    api.emit("exit", 0);
    worker.emit("exit", 0);
    expect(onExit).toHaveBeenCalledExactlyOnceWith(0);
  });
});
