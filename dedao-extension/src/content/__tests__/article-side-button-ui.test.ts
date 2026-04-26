/**
 * @jest-environment jsdom
 */

import { ArticleSideButtonUI, type SideAction } from '../article-side-button-ui.ts';

const ICON = '<svg data-icon="dummy"></svg>';

const ACTIONS: SideAction[] = [
    { id: 'capture', label: '下长图', iconSvg: ICON },
    { id: 'md-download', label: '下 Markdown', iconSvg: ICON },
    { id: 'md-copy', label: '复制 Markdown', iconSvg: ICON },
];

function setupDom(): HTMLElement {
    document.head.innerHTML = '';
    document.body.innerHTML = `
        <aside class="iget-side-button iget-side-portrait">
            <div class="side-button-main">
                <div class="button-module"><button class="button"></button><span>留言</span></div>
            </div>
            <div class="side-button-main">
                <div class="button-module"><button class="button"></button><span>手机端</span></div>
            </div>
        </aside>
    `;
    return document.querySelector('aside.iget-side-button') as HTMLElement;
}

describe('ArticleSideButtonUI', () => {
    it('mounts wrapper before phone block', () => {
        const aside = setupDom();
        const ui = new ArticleSideButtonUI({ actions: ACTIONS, onSelect: jest.fn() });
        ui.mount(aside);

        expect(aside.querySelector('.dd-course-shot-label')?.textContent).toBe('导出');
        expect(aside.querySelector('.dd-course-shot-button [data-icon="download"]')).not.toBeNull();
    });

    it('renders one menu item per action', () => {
        const aside = setupDom();
        const ui = new ArticleSideButtonUI({ actions: ACTIONS, onSelect: jest.fn() });
        ui.mount(aside);

        const items = aside.querySelectorAll('.dd-course-shot-menu li');
        expect(items.length).toBe(3);
        expect(items[1].textContent).toContain('下 Markdown');
    });

    it('opens menu on button click and triggers onSelect, then closes', () => {
        const aside = setupDom();
        const onSelect = jest.fn();
        const ui = new ArticleSideButtonUI({ actions: ACTIONS, onSelect });
        ui.mount(aside);

        const button = aside.querySelector('.dd-course-shot-button') as HTMLButtonElement;
        const menu = aside.querySelector('.dd-course-shot-menu') as HTMLElement;
        expect(menu.dataset.open).toBe('false');

        button.click();
        expect(menu.dataset.open).toBe('true');

        const mdItem = menu.querySelectorAll('li')[1] as HTMLElement;
        mdItem.click();
        expect(onSelect).toHaveBeenCalledWith('md-download');
        expect(menu.dataset.open).toBe('false');
    });

    it('closes menu on document click outside wrapper', () => {
        const aside = setupDom();
        const ui = new ArticleSideButtonUI({ actions: ACTIONS, onSelect: jest.fn() });
        ui.mount(aside);

        const button = aside.querySelector('.dd-course-shot-button') as HTMLButtonElement;
        const menu = aside.querySelector('.dd-course-shot-menu') as HTMLElement;
        button.click();
        expect(menu.dataset.open).toBe('true');

        document.body.click();
        expect(menu.dataset.open).toBe('false');
    });

    it('does not open menu when busy', () => {
        const aside = setupDom();
        const ui = new ArticleSideButtonUI({ actions: ACTIONS, onSelect: jest.fn() });
        ui.mount(aside);
        const button = aside.querySelector('.dd-course-shot-button') as HTMLButtonElement;
        const menu = aside.querySelector('.dd-course-shot-menu') as HTMLElement;

        ui.setBusy('生成中');
        button.click();
        expect(menu.dataset.open).toBe('false');
    });

    it('updates label across busy/progress/success/error', () => {
        const aside = setupDom();
        const ui = new ArticleSideButtonUI({ actions: ACTIONS, onSelect: jest.fn() });
        ui.mount(aside);
        const label = aside.querySelector('.dd-course-shot-label') as HTMLElement;

        ui.setBusy('拼接中');
        expect(label.textContent).toBe('拼接中');

        ui.setProgress(34, '下长图中');
        expect(label.textContent).toBe('下长图中 34%');

        ui.setSuccess('已复制');
        expect(label.textContent).toBe('已复制');
        expect(aside.querySelector('.dd-course-shot-button [data-icon="success"]')).not.toBeNull();

        ui.setError('失败');
        expect(label.textContent).toBe('失败');
    });

    it('does not remount when already mounted in same container', () => {
        const aside = setupDom();
        const ui = new ArticleSideButtonUI({ actions: ACTIONS, onSelect: jest.fn() });
        ui.mount(aside);
        const root = ui.getElement();
        const removeSpy = jest.spyOn(root, 'remove');

        ui.mount(aside);

        expect(removeSpy).not.toHaveBeenCalled();
        expect(ui.getElement().parentElement).toBe(aside);
    });
});
