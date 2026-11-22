Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    title: {
      type: String,
      value: '',
    },
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    },
    onMaskTap() {
      this.triggerEvent('close');
    },
    noop() {
      /* 阻止点击穿透 */
    },
  },
});
