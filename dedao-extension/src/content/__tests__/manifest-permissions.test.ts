import manifest from '../../../public/manifest.json';

describe('manifest permissions for article screenshot', () => {
    it('should include all_urls host permission for captureVisibleTab flow', () => {
        expect(manifest.host_permissions).toContain('<all_urls>');
    });
});
