// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { expect } from 'chai';

import { toArray } from '@phosphor/algorithm';

import { JSONExt } from '@phosphor/coreutils';

import { KernelManager, Kernel, KernelSpec } from '@jupyterlab/services';

import { testEmission } from '@jupyterlab/testutils';

import {
  PYTHON_SPEC,
  KERNELSPECS,
  handleRequest,
  makeSettings
} from '../utils';

class TestManager extends KernelManager {
  intercept: KernelSpec.ISpecModels | null = null;
  protected async requestSpecs(): Promise<void> {
    if (this.intercept) {
      handleRequest(this, 200, this.intercept);
    }
    return super.requestSpecs();
  }
}

const PYTHON3_SPEC = JSON.parse(JSON.stringify(PYTHON_SPEC));
PYTHON3_SPEC.name = 'Python3';
PYTHON3_SPEC.display_name = 'python3';

describe('kernel/manager', () => {
  let manager: KernelManager;
  let kernel: Kernel.IKernelConnection;

  beforeAll(async () => {
    kernel = await Kernel.startNew();
  });

  beforeEach(() => {
    manager = new KernelManager({ standby: 'never' });
    expect(manager.specs).to.be.null;
    return manager.ready;
  });

  afterEach(() => {
    manager.dispose();
  });

  afterAll(async () => {
    let models = await Kernel.listRunning();
    await Promise.all(models.map(m => Kernel.shutdown(m.id)));
  });

  describe('KernelManager', () => {
    describe('#constructor()', () => {
      it('should take the options as an argument', () => {
        manager.dispose();
        manager = new KernelManager({
          serverSettings: makeSettings(),
          standby: 'never'
        });
        expect(manager instanceof KernelManager).to.equal(true);
      });
    });

    describe('#serverSettings', () => {
      it('should get the server settings', () => {
        manager.dispose();
        const serverSettings = makeSettings();
        const standby = 'never';
        const token = serverSettings.token;
        manager = new KernelManager({ serverSettings, standby });
        expect(manager.serverSettings.token).to.equal(token);
      });
    });

    describe('#specs', () => {
      it('should get the kernel specs', async () => {
        await manager.ready;
        expect(manager.specs.default).to.be.ok;
      });
    });

    describe('#running()', () => {
      it('should get the running sessions', async () => {
        await manager.refreshRunning();
        expect(toArray(manager.running()).length).to.be.greaterThan(0);
      });
    });

    describe('#specsChanged', () => {
      it('should be emitted when the specs change', async () => {
        const manager = new TestManager({ standby: 'never' });
        const specs = JSONExt.deepCopy(KERNELSPECS) as Kernel.ISpecModels;
        let called = false;
        manager.specsChanged.connect(() => {
          called = true;
        });
        await manager.ready;
        expect(manager.specs.default).to.equal('echo');
        specs.default = 'shell';
        manager.intercept = specs;
        await manager.refreshSpecs();
        expect(manager.specs.default).to.equal('shell');
        expect(called).to.equal(true);
      });
    });

    describe('#runningChanged', () => {
      it('should be emitted in refreshRunning when the running kernels changed', async () => {
        let called = false;
        manager.runningChanged.connect((sender, args) => {
          expect(sender).to.equal(manager);
          expect(toArray(args).length).to.be.greaterThan(0);
          called = true;
        });
        await Kernel.startNew();
        await manager.refreshRunning();
        expect(called).to.equal(true);
      });

      it('should be emitted when a kernel is shut down', async () => {
        const kernel = await manager.startNew();
        let called = false;
        manager.runningChanged.connect(() => {
          called = true;
        });
        await kernel.shutdown();
        expect(called).to.equal(true);
      });
    });

    describe('#isReady', () => {
      it('should test whether the manager is ready', async () => {
        manager.dispose();
        manager = new KernelManager({ standby: 'never' });
        expect(manager.isReady).to.equal(false);
        await manager.ready;
        expect(manager.isReady).to.equal(true);
      });
    });

    describe('#ready', () => {
      it('should resolve when the manager is ready', () => {
        return manager.ready;
      });
    });

    describe('#refreshSpecs()', () => {
      it('should update list of kernel specs', async () => {
        const manager = new TestManager({ standby: 'never' });
        const specs = JSONExt.deepCopy(KERNELSPECS) as Kernel.ISpecModels;
        await manager.ready;
        specs.default = 'shell';
        manager.intercept = specs;
        expect(manager.specs.default).not.to.equal('shell');
        await manager.refreshSpecs();
        expect(manager.specs.default).to.equal('shell');
      });
    });

    describe('#refreshRunning()', () => {
      it('should update the running kernels', async () => {
        await manager.refreshRunning();
        expect(toArray(manager.running()).length).to.be.greaterThan(0);
      });
    });

    describe('#startNew()', () => {
      it('should start a new kernel', () => {
        return manager.startNew();
      });

      it('should emit a runningChanged signal', async () => {
        let called = false;
        manager.runningChanged.connect(() => {
          called = true;
        });
        await manager.startNew();
        expect(called).to.equal(true);
      });
    });

    describe('#findById()', () => {
      it('should find an existing kernel by id', async () => {
        const id = kernel.id;
        const model = await manager.findById(id);
        expect(model.id).to.equal(id);
      });
    });

    describe('#connectTo()', () => {
      it('should connect to an existing kernel', () => {
        const id = kernel.id;
        const newConnection = manager.connectTo(kernel.model);
        expect(newConnection.model.id).to.equal(id);
      });

      it('should emit a runningChanged signal', async () => {
        let called = false;
        manager.runningChanged.connect(() => {
          called = true;
        });
        const k = await Kernel.startNew();
        manager.connectTo(k.model);
        expect(called).to.equal(true);
      });
    });

    describe('shutdown()', () => {
      it('should shut down a kernel by id', async () => {
        const kernel = await manager.startNew();
        await manager.shutdown(kernel.id);
        expect(kernel.isDisposed).to.equal(true);
      });

      it('should emit a runningChanged signal', async () => {
        const kernel = await manager.startNew();
        const emission = testEmission(manager.runningChanged, {
          test: () => {
            expect(kernel.isDisposed).to.equal(false);
          }
        });
        await manager.shutdown(kernel.id);
        await emission;
      });
    });
  });
});
