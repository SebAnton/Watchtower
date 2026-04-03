/**
 * Confirm modal UI.
 */
(function (global) {
    'use strict';

    const { els } = global.Watchtower.dom;

    function showConfirmModal(messageHtml, onConfirmCallback) {
        els.confirmMessage.innerHTML = messageHtml;
        els.confirmModal.classList.remove('hidden');

        const cleanup = () => {
            els.confirmModal.classList.add('hidden');
            els.confirmOkBtn.removeEventListener('click', onOk);
            els.confirmCancelBtn.removeEventListener('click', onCancel);
        };

        const onOk = () => {
            cleanup();
            onConfirmCallback();
        };

        const onCancel = () => cleanup();

        els.confirmOkBtn.addEventListener('click', onOk);
        els.confirmCancelBtn.addEventListener('click', onCancel);
    }

    global.Watchtower = global.Watchtower || {};
    global.Watchtower.modal = { showConfirmModal };
})(typeof window !== 'undefined' ? window : this);
