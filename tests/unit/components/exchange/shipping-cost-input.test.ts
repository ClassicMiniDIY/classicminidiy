// @vitest-environment happy-dom
/**
 * <ExchangeListingsShippingCostInput> (app/components/exchange/listings/ShippingCostInput.vue):
 * the shipping cost field in the listing wizard, the edit page and bulk upload.
 * 0 = free shipping, null = varies by location, > 0 = flat cost.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ShippingCostInput from '~/app/components/exchange/listings/ShippingCostInput.vue';

function mountInput(modelValue: number | null, currency?: string) {
  const updates: Array<number | null> = [];
  const wrapper = mount(ShippingCostInput, {
    props: {
      modelValue,
      currency,
      'onUpdate:modelValue': (value: number | null) => {
        updates.push(value);
        wrapper.setProps({ modelValue: value });
      },
    },
  });
  return { wrapper, updates };
}

describe('ExchangeListingsShippingCostInput', () => {
  it('stores 0 when the seller ticks free shipping, and hides the amount', async () => {
    const { wrapper, updates } = mountInput(null);
    await wrapper.find('input[type="checkbox"]').setValue(true);
    expect(updates.at(-1)).toBe(0);
    expect(wrapper.find('input[type="number"]').exists()).toBe(false);
  });

  it('shows a stored 0 as free shipping, not as an empty amount', () => {
    const { wrapper } = mountInput(0);
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true);
  });

  it('stores null when free shipping is unticked', async () => {
    const { wrapper, updates } = mountInput(0);
    await wrapper.find('input[type="checkbox"]').setValue(false);
    expect(updates.at(-1)).toBeNull();
  });

  it('stores a typed cost as a number and an emptied field as null', async () => {
    const { wrapper, updates } = mountInput(null);
    const amount = wrapper.find('input[type="number"]');
    await amount.setValue('12.5');
    expect(updates.at(-1)).toBe(12.5);
    await amount.setValue('');
    expect(updates.at(-1)).toBeNull();
  });

  it('keeps the amount field while the seller types a cost below 1', async () => {
    const { wrapper, updates } = mountInput(null);
    const amount = wrapper.find('input[type="number"]');
    await amount.setValue('0');
    expect(updates.at(-1)).toBe(0);
    expect(wrapper.find('input[type="number"]').exists()).toBe(true);
    await wrapper.find('input[type="number"]').setValue('0.75');
    expect(updates.at(-1)).toBe(0.75);
  });

  it('unticks free shipping when the parent replaces 0 with a cost', async () => {
    const { wrapper } = mountInput(0);
    await wrapper.setProps({ modelValue: 9 });
    expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(false);
  });

  it('shows the listing currency symbol', () => {
    const { wrapper } = mountInput(null, 'GBP');
    expect(wrapper.text()).toContain('£');
  });
});
