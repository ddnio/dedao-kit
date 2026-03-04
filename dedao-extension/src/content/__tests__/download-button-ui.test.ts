/**
 * @jest-environment jsdom
 */

import { DownloadButtonUI } from '../download-button-ui.ts';

describe('DownloadButtonUI style sync', () => {
    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    it('应在挂载时对齐“开始阅读”按钮的关键样式', () => {
        const readButton = document.createElement('button');
        readButton.textContent = '开始阅读';
        readButton.style.height = '42px';
        readButton.style.padding = '0px 24px';
        readButton.style.fontSize = '16px';
        readButton.style.fontWeight = '600';
        readButton.style.lineHeight = '42px';
        readButton.style.marginRight = '12px';
        readButton.style.border = '1px solid rgb(240, 130, 20)';
        readButton.style.borderRadius = '20px 0px 0px 20px';
        readButton.style.backgroundColor = 'rgb(240, 130, 20)';
        readButton.style.color = 'rgb(255, 255, 255)';
        document.body.appendChild(readButton);

        const ui = new DownloadButtonUI({ onClick: jest.fn() });
        ui.mountNextTo(readButton);

        const btn = ui.getElement();
        expect(btn.textContent).toBe('下载');
        expect(btn.style.getPropertyValue('--dd-btn-height')).toBe('42px');
        expect(btn.style.getPropertyValue('--dd-btn-padding')).toBe('0px 24px');
        expect(btn.style.getPropertyValue('--dd-btn-font-size')).toBe('16px');
        expect(btn.style.getPropertyValue('--dd-btn-font-weight')).toBe('600');
        expect(btn.style.getPropertyValue('--dd-btn-line-height')).toBe('42px');
        expect(btn.style.getPropertyValue('--dd-btn-margin-left')).toBe('12px');
        expect(btn.style.getPropertyValue('--dd-btn-bg')).toBe('rgb(240, 130, 20)');
        expect(btn.style.getPropertyValue('--dd-btn-color')).toBe('rgb(255, 255, 255)');
    });

    it('应优先继承“开始阅读”左侧按钮样式，而不是 VIP 容器样式', () => {
        const readButton = document.createElement('button');
        readButton.style.display = 'inline-flex';
        readButton.style.alignItems = 'center';
        readButton.style.color = 'rgb(130, 96, 52)'; // 容器偏 VIP 色
        readButton.style.border = '1px solid rgb(234, 220, 180)';

        const readPart = document.createElement('span');
        readPart.textContent = '开始阅读';
        readPart.style.backgroundColor = 'rgb(246, 123, 26)';
        readPart.style.color = 'rgb(255, 255, 255)';
        readPart.style.padding = '0px 28px';
        readPart.style.height = '42px';
        readPart.style.lineHeight = '42px';
        readPart.style.borderRadius = '21px 0px 0px 21px';

        const vipPart = document.createElement('span');
        vipPart.textContent = 'VIP';
        vipPart.style.backgroundColor = 'rgb(242, 229, 193)';
        vipPart.style.color = 'rgb(130, 96, 52)';
        vipPart.style.padding = '0px 18px';
        vipPart.style.height = '42px';
        vipPart.style.lineHeight = '42px';
        vipPart.style.borderRadius = '0px 21px 21px 0px';

        readButton.appendChild(readPart);
        readButton.appendChild(vipPart);
        document.body.appendChild(readButton);

        const ui = new DownloadButtonUI({ onClick: jest.fn() });
        ui.mountNextTo(readButton);

        const btn = ui.getElement();
        expect(btn.style.getPropertyValue('--dd-btn-color')).toBe('rgb(255, 255, 255)');
        expect(btn.style.getPropertyValue('--dd-btn-bg')).toBe('rgb(246, 123, 26)');
        expect(btn.style.getPropertyValue('--dd-btn-padding')).toBe('0px 28px');
    });
});
