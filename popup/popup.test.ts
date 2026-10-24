import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ clearSharedData:vi.fn(), ensureStorageReady:vi.fn(), exportBackup:vi.fn(), importBackup:vi.fn(), recoverPendingPublication:vi.fn() }));
vi.mock('../src/core/storageClient', () => mocks);
let readyListener: EventListener;
let tabs: Array<{id:number;url:string}>;
let sendMessage: ReturnType<typeof vi.fn>;
let preferenceChanged: (changes: Record<string, { newValue?: unknown }>, area: string) => void;
let preferenceGet: ReturnType<typeof vi.fn>;
let preferenceSet: ReturnType<typeof vi.fn>;
const preferenceKey = 'sokker++:history-buttons-visible';
const preferenceCheckbox = () => document.getElementById('historyButtonsVisible') as HTMLInputElement;
const status = () => document.getElementById('status')!.textContent;
const click = (id:string) => document.getElementById(id)!.click();
async function reopenPopup(): Promise<void> {
    // A fresh document and module context, as when the browser reopens a popup.
    vi.resetModules();
    document.getElementById('historyButtonsVisible')!.outerHTML = '<input type="checkbox" id="historyButtonsVisible" checked disabled>';
    await import('./popup'); readyListener(new Event('DOMContentLoaded'));
}
beforeEach(async () => {
    vi.resetModules(); vi.clearAllMocks(); localStorage.clear();
    document.body.innerHTML = '<div id="status"></div><p id="recovery" hidden></p><button id="syncBtn"></button><button id="repairBtn"></button><button id="exportBtn"></button><button id="importBtn"></button><button id="clearBtn"></button><input type="file" id="importFile">';
    document.body.insertAdjacentHTML('afterbegin', '<label for="historyButtonsVisible"><input type="checkbox" id="historyButtonsVisible" checked disabled><span id="historyButtonsLabel"></span></label><p id="historyButtonsHint"></p><p id="historyButtonsError" role="alert" hidden></p>');
    tabs=[];sendMessage=vi.fn();
    preferenceGet = vi.fn().mockResolvedValue({}); preferenceSet = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chrome',{runtime:{},i18n:{getUILanguage:()=> 'en-US'},storage:{local:{get:preferenceGet,set:preferenceSet},onChanged:{addListener:(listener:typeof preferenceChanged)=>{preferenceChanged=listener;}}},tabs:{query:(_filter:unknown,callback:(tabs:unknown)=>void)=>callback(tabs),sendMessage}});
    vi.spyOn(document,'addEventListener').mockImplementation((type,listener) => {if(type==='DOMContentLoaded')readyListener=listener as EventListener;});
    mocks.ensureStorageReady.mockResolvedValue({epoch:'epoch-1',revision:0,migration:{}});
    mocks.recoverPendingPublication.mockResolvedValue(null);
    mocks.exportBackup.mockResolvedValue({formatVersion:2,players:[]});
    mocks.importBackup.mockResolvedValue(undefined); mocks.clearSharedData.mockResolvedValue(undefined);
    vi.stubGlobal('confirm',vi.fn().mockReturnValue(true));
    Object.defineProperty(URL,'createObjectURL',{configurable:true,value:vi.fn().mockReturnValue('blob:test')});
    Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:vi.fn()});
    vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    await import('./popup');readyListener(new Event('DOMContentLoaded'));
    await vi.waitFor(()=>expect(status()).toBe('Shared history is ready.'));
});

describe('global history button preference', () => {
    it('waits for the stored setting before enabling the checkbox on reopen', async () => {
        let finish!: (value: Record<string, unknown>) => void;
        preferenceGet.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
        await reopenPopup();
        expect(preferenceCheckbox().disabled).toBe(true);
        finish({ [preferenceKey]: false });
        await vi.waitFor(() => expect(preferenceCheckbox().disabled).toBe(false));
        expect(preferenceCheckbox().checked).toBe(false);
    });

    it('keeps failed initialization disabled with accessible feedback and history still ready', async () => {
        preferenceGet.mockRejectedValue(new Error('Read unavailable'));
        await reopenPopup();
        await vi.waitFor(() => expect(document.getElementById('historyButtonsError')!.hidden).toBe(false));
        expect(preferenceCheckbox().disabled).toBe(true);
        expect(document.getElementById('historyButtonsError')!.textContent).toContain('Could not load');
        expect(status()).toBe('Shared history is ready.');
    });

    it('starts enabled and saves the checkbox without a Sokker tab or history operation', async () => {
        const checkbox = preferenceCheckbox();
        expect(checkbox.checked).toBe(true); expect(checkbox.disabled).toBe(false);
        checkbox.click();
        expect(checkbox.disabled).toBe(true);
        await vi.waitFor(() => expect(checkbox.disabled).toBe(false));
        expect(checkbox.checked).toBe(false);
        expect(preferenceSet).toHaveBeenCalledWith({ [preferenceKey]: false });
        expect(sendMessage).not.toHaveBeenCalled(); expect(mocks.clearSharedData).not.toHaveBeenCalled();
    });

    it('reflects changes from another context and restores its value after a failed write', async () => {
        preferenceChanged({ [preferenceKey]: { newValue: false } }, 'local');
        const checkbox = preferenceCheckbox();
        expect(checkbox.checked).toBe(false);
        preferenceSet.mockRejectedValue(new Error('Storage failed'));
        checkbox.click();
        await vi.waitFor(() => expect(checkbox.disabled).toBe(false));
        expect(checkbox.checked).toBe(false);
        const error = document.getElementById('historyButtonsError')!;
        expect(error.hidden).toBe(false); expect(error.getAttribute('role')).toBe('alert');
        expect(error.textContent).toContain('Could not save');
        expect(status()).toBe('Shared history is ready.');
    });

    it('uses Spanish for the preference when the browser language is Spanish', () => {
        vi.spyOn(chrome.i18n, 'getUILanguage').mockReturnValue('es-ES');
        readyListener(new Event('DOMContentLoaded'));
        expect(document.getElementById('historyButtonsLabel')!.textContent).toBe('Mostrar botones + de historial');
        expect(document.getElementById('historyButtonsHint')!.textContent).toContain('todas las páginas');
    });
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('popup shared data without a Sokker tab',()=>{
    it('exports and clears directly through verified storage facades',async()=>{
        click('exportBtn');await vi.waitFor(()=>expect(status()).toBe('Export successful.'));
        expect(mocks.exportBackup).toHaveBeenCalledOnce();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
        click('clearBtn');await vi.waitFor(()=>expect(status()).toBe('Data cleared.'));
        expect(mocks.clearSharedData).toHaveBeenCalledOnce();expect(sendMessage).not.toHaveBeenCalled();
    });
    it('imports through the storage facade and never sends the backup to content',async()=>{
        let reader: {result:string|null;onload:(()=>void)|null;readAsText:ReturnType<typeof vi.fn>};
        vi.stubGlobal('FileReader',class {result=JSON.stringify({players:[]});onload:(()=>void)|null=null;readAsText=vi.fn(()=>queueMicrotask(()=>this.onload?.()));constructor(){reader=this as unknown as typeof reader;}});
        const input=document.getElementById('importFile') as HTMLInputElement;
        Object.defineProperty(input,'files',{configurable:true,value:[new File(['{}'],'backup.json')]});
        input.dispatchEvent(new Event('change'));
        await vi.waitFor(()=>expect(status()).toBe('Import successful.'));
        expect(mocks.importBackup).toHaveBeenCalledWith({players:[]});expect(sendMessage).not.toHaveBeenCalled();
    });
    it('leaves clearing cancelled when its existing confirmation is declined',async()=>{
        vi.mocked(confirm).mockReturnValue(false);click('clearBtn');
        expect(mocks.clearSharedData).not.toHaveBeenCalled();
    });
    it('explains why synchronization and repair require a Sokker tab',async()=>{
        for(const id of ['syncBtn','repairBtn']){click(id);await vi.waitFor(()=>expect(status()).toContain('Open a Sokker page'));}
        expect(sendMessage).not.toHaveBeenCalled();
    });
    it('only forwards coordination commands to an authorized Sokker host',async()=>{
        tabs=[{id:1,url:'https://sokker.org.example.test/squad'}];click('syncBtn');
        await vi.waitFor(()=>expect(status()).toContain('Open a Sokker page'));expect(sendMessage).not.toHaveBeenCalled();
        tabs=[{id:2,url:'https://app.sokker.org/squad'}];
        sendMessage.mockImplementation((_id,request,callback)=>callback({status:'success',result:request.action==='FORCE_SYNC'?{status:'synced',weeks:3,lastWeek:1200}:{gapsFilled:2,rosterSize:20}}));
        click('syncBtn');await vi.waitFor(()=>expect(status()).toContain('Synced 3 weeks'));
        click('repairBtn');await vi.waitFor(()=>expect(status()).toContain('2 gap(s) filled'));
    });
    it('surfaces a transfer failure without announcing a successful export or import',async()=>{
        mocks.exportBackup.mockRejectedValue(new Error('Transfer integrity mismatch'));click('exportBtn');
        await vi.waitFor(()=>expect(status()).toBe('Error: Transfer integrity mismatch'));
    });
    it('checks a durable publication receipt on reopen without repeating the import',async()=>{
        mocks.recoverPendingPublication.mockResolvedValue({state:'migrated'});
        readyListener(new Event('DOMContentLoaded'));
        await vi.waitFor(()=>expect(status()).toContain('Previous import confirmed'));
        expect(mocks.importBackup).not.toHaveBeenCalled();
    });
    it('shows recovery guidance when the principal origin has not been inspected',()=>{
        expect(document.getElementById('recovery')!.hidden).toBe(false);
    });
});
