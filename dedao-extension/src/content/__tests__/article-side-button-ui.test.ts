/**
 * @jest-environment jsdom
 */

import { ArticleSideButtonUI } from '../article-side-button-ui.ts';

describe('ArticleSideButtonUI', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = `
            <aside class="iget-side-button iget-side-portrait">
                <div class="side-button-main">
                    <div class="button-module iget-common-b9">
                        <button class="button iget-common-b4"></button>
                        <span class="font iget-common-f6 iget-common-c3">留言</span>
                    </div>
                </div>
                <div class="side-button-main">
                    <div class="button-module iget-common-b9">
                        <button class="button iget-common-b4"></button>
                        <span class="font iget-common-f6 iget-common-c3">手机端</span>
                    </div>
                </div>
            </aside>
        `;
    });

    it('should mount inside dedao side rail', () => {
        const aside = document.querySelector('aside.iget-side-button') as HTMLElement;
        const ui = new ArticleSideButtonUI({ onClick: jest.fn() });

        ui.mount(aside);

        const label = aside.querySelector('.dd-course-shot-label');
        expect(label?.textContent).toBe('下长图');
        expect(aside.querySelector('.dd-course-shot-button [data-icon="download"]')).not.toBeNull();
    });

    it('should update label for progress states', () => {
        const aside = document.querySelector('aside.iget-side-button') as HTMLElement;
        const ui = new ArticleSideButtonUI({ onClick: jest.fn() });
        ui.mount(aside);

        ui.setCapturingProgress(34);
        expect(aside.querySelector('.dd-course-shot-label')?.textContent).toBe('下载中 34%');

        ui.setStitching();
        expect(aside.querySelector('.dd-course-shot-label')?.textContent).toBe('拼接中');

        ui.setError('failed');
        expect(aside.querySelector('.dd-course-shot-label')?.textContent).toBe('失败重试');
    });

    it('should not remount when already mounted in the same side rail', () => {
        const aside = document.querySelector('aside.iget-side-button') as HTMLElement;
        const ui = new ArticleSideButtonUI({ onClick: jest.fn() });
        ui.mount(aside);

        const root = ui.getElement();
        const removeSpy = jest.spyOn(root, 'remove');

        ui.mount(aside);

        expect(removeSpy).not.toHaveBeenCalled();
        expect(ui.getElement().parentElement).toBe(aside);
    });
});
