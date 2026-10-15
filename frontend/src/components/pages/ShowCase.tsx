import { useCallback, useEffect, useState } from 'react';
import _ from 'lodash';
import { useNavigate } from 'react-router';
import { Trash2Icon, PlusIcon } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import FormField from 'src/components/common/FormField';
import { Button } from 'src/components/shadui/button';
import { useStore } from 'src/state-store';
import { useTranslation } from 'react-i18next';

import VietnamCityPicker from 'src/components/common/VietnamCityPicker';
import Modal from 'src/components/common/Modal';
import ImageGallery from 'src/components/common/ImageGallery';
import ImageUpload from 'src/components/common/ImageUpload';
import Memoizer from 'src/components/common/Memoizer';
import AutoSuggestion, { type Item, type AutoSuggestionProps } from 'src/components/common/AutoSuggestion';
import type { Image } from 'src/components/common/ImageUpload';
import { useNotification } from 'src/components/common/NotificationProvider';
import ThemeToggle from 'src/components/common/ThemeToggle';
import { useAnalytics } from 'src/utils/hooks';
import { useOneTimeQueryParams, useIsMobile } from 'src/utils/hooks';
import FullScreenLoading from 'src/components/common/FullScreenLoading';
import MultiSelect from 'src/components/common/MultiSelect';
import Info from 'src/components/common/Info';
import LinkButton from 'src/components/common/LinkButton';
import LanguageSelector from 'src/components/common/LanguageSelector';

type ExampleFormValues = {
  field1: string;
  city: string;
  complexField: { innerObject: Item | null; innerText: string }[];
  images: Image[];
};

function ExampleAutoSuggestion(props: Partial<AutoSuggestionProps> & Pick<AutoSuggestionProps, 'onChange'>) {
  // Simulate backend request. Results are always a list of objects. One of them would be selected
  // by the user as the value of the component.
  function getSuggestionsFromBackend(query: string) {
    const results = [
      {
        id: 1,
        label: query,
        createdAt: new Date(),
      },
      {
        id: 2,
        label: query + query,
        createdAt: new Date(),
      },
      {
        id: 3,
        label: query + query + query,
        createdAt: new Date(),
      },
    ];
    return new Promise<typeof results>(resolve => {
      resolve(results);
    });
  }

  // Provides a function to render the item however the caller wants. If not, AutoSuggestion provides
  // a default renderer that works almost like this (e.g. using the `id` and `label` attributes of the item).
  const renderSuggestion = useCallback((item: Item, handleSelectItem: (item: Item) => void) => {
    return (
      <p
        key={item.id}
        onClick={() => handleSelectItem(item)}
        className='cursor-pointer px-4 py-2 transition-colors hover:bg-muted'
      >
        {item.label}
      </p>
    );
  }, []);

  return (
    <AutoSuggestion
      fullWidth
      label='Pick one *'
      onSearch={getSuggestionsFromBackend}
      debounceMs={500}
      renderSuggestion={renderSuggestion}
      {...props}
    />
  );
}

function ExampleForm() {
  const notify = useNotification();
  const navigate = useNavigate();

  const {
    control,
    handleSubmit,
    trigger,
    watch,
    // If we want to set default values to the form using a record fetched form db,
    // use `setValue` to do it field by field.
    // setValue,
  } = useForm({
    mode: 'onSubmit',
    defaultValues: {
      field1: '',
      city: '',
      // Show casing array of objects in form.
      complexField: [
        {
          innerObject: null,
          innerText: '',
        },
      ],
      images: [],
    },
  });

  // Use `useFieldArray` for list-based composite fields so we can validate nested fields.
  // For `images` field, it's also an array of objects but we don't need to validate nested fields
  // so we don't use `useFieldArray` for it.
  const { fields, append: appendComplexFieldItem, remove: removeComplexFieldItem } = useFieldArray({
    control,
    name: 'complexField',
  });

  const complexFieldWatch = watch('complexField');

  const onSubmit = async (data: ExampleFormValues) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('data', JSON.stringify({
        field1: data.field1,
        complexField: _.map(data.complexField, item => ({
          id: _.get(item, 'innerObject.id'),
          name: _.get(item, 'innerObject.label'),
          createdAt: _.get(item, 'innerObject.createdAt'),
          innerText: item.innerText,
        })),
        city: data.city,
      }));

      data.images.forEach((image: Image) => {
        // This check is to handle the case where the existing record already has some images
        // (e.g. uploaded when it was first created). In this update we only upload the new images
        // and keep the existing ones intact.
        // If `image` has a `file` attribute, it's a new image.
        if (image.file) {
          formDataToSend.append('images', image.file);
        } else {
          // Kind of a pain but when setting default values for ImageUpload we have to inject an id
          // (usually v4()) to each item, and when sending data to server we have to remove these client-side ids.
          formDataToSend.append('images', JSON.stringify(_.omit(image, 'id')));
        }
      });

      // eslint-disable-next-line
      console.log('Data to server submited', formDataToSend);

      // Redirect back here for demonstration purpose.
      // We will use useOneTimeQueryParams to show the form submit success notification.
      navigate('/showcase?notifySuccess=true');
    } catch {
      notify('error', (
        <p>
          Submit form failed. Please try again.
        </p>
      ));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Using gap-6 tailwind divs to stack input components */}
      <div className='flex flex-col gap-6'>
        <Controller
          name='field1'
          control={control}
          render={(field) => {
            return (
              <FormField
                label='Field 1'
                placeholder='Input field 1...'
                multiline
                minRows={3}
                fullWidth
                // These 4 props are usually the same for all form fields except for some special cases
                value={field.field.value}
                onChange={field.field.onChange}
                error={!_.isNil(_.get(field, 'fieldState.error'))}
                helperText={_.get(field, 'fieldState.error.message')}
              />
            );
          }}
        />

        <div>
          <div className='mb-3'>
            <p>
              Configure at least one complex field item
            </p>
          </div>
          <div className='flex flex-col gap-4'>
            {fields.map((field, index) => (
              <div key={field.id} className='relative flex flex-row gap-4 sm:pr-0'>
                <div className='flex flex-col sm:flex-row gap-4 w-full'>
                  <Controller
                    name={`complexField.${index}.innerObject`}
                    control={control}
                    rules={{
                      validate: {
                        // Custom validation made possible by react-hook-form. Validation name doesn't matter.
                        requireSelection: (val: Item | null) => {
                          // Remember, `val` is an object chosen by user from a list of suggestions.
                          if (!val) {
                            return 'Please pick one';
                          }
                          return true;
                        },
                      },
                    }}
                    render={(field) => {
                      return (
                        <div className='w-full sm:flex-1'>
                          <ExampleAutoSuggestion
                            value={field.field.value}
                            onChange={field.field.onChange}
                            error={!_.isNil(_.get(field, 'fieldState.error'))}
                            helperText={_.get(field, 'fieldState.error.message')}
                          />
                        </div>
                      );
                    }}
                  />

                  <Controller
                    rules={{ required: 'Must contain value' }}
                    name={`complexField.${index}.innerText`}
                    control={control}
                    render={(field) => {
                      return (
                        <FormField
                          className='w-full sm:w-48'
                          label='Inner text'
                          value={field.field.value}
                          onChange={field.field.onChange}
                          error={!_.isNil(_.get(field, 'fieldState.error'))}
                          helperText={_.get(field, 'fieldState.error.message')}
                        />
                      );
                    }}
                  />
                </div>

                <div className='flex items-start'>

                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label='Remove item'
                    onClick={() => removeComplexFieldItem(index)}
                    disabled={complexFieldWatch.length <= 1}
                  >
                    <Trash2Icon />
                  </Button>
                </div>

              </div>
            ))}
          </div>

          <div className='mt-2'>
            <Button
              size='sm'
              onClick={() => appendComplexFieldItem({ innerObject: null, innerText: '' })}
            >
              <PlusIcon />
              Add complex field item
            </Button>
          </div>
        </div>

        <Controller
          name='city'
          control={control}
          rules={{ required: 'This is required' }}
          render={(field) => {
            return (
              <VietnamCityPicker
                label='City *'
                fullWidth
                value={field.field.value}
                onChange={field.field.onChange}
                error={!_.isNil(_.get(field, 'fieldState.error'))}
                helperText={_.get(field, 'fieldState.error.message')}
              />
            );
          }}
        />

        <Controller
          name='images'
          control={control}
          rules={{
            validate: {
              maxImages: (val: Image[]) => {
                if (val.length > 4) {
                  return 'Maximum 4 images only';
                }
                return true;
              },
            },
          }}
          render={field => {
            return (
              // We need this to memoize the onChange function passed to ImageUpload,
              // to prevent rerender the image list which is bad on UX.
              <Memoizer
                resolverss={[[field.field.onChange, trigger]]}
                funcs={[(val: Image[]) => {
                  field.field.onChange(val);
                  // Trigger right away because we want this field to always show validation error
                  // whether we have submitted or not.
                  trigger('images');
                }]}
                render={(items) => (
                  <ImageUpload
                    text='Upload images'
                    value={field.field.value}
                    onChange={items[0] as (images: Image[]) => void}
                    error={!_.isNil(_.get(field, 'fieldState.error'))}
                    helperText={_.get(field, 'fieldState.error.message')}
                  />
                )}
              />
            );
          }}
        />
      </div>
      <div className='w-full mt-9'>
        <Button

          type='submit'
          className='w-full'
          size='lg'
        >
          Submit
        </Button>
      </div>
    </form>
  );
}

function ExampleModal() {
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <>
      <Button  onClick={() => setModalOpen(true)}>Open Modal</Button>
      {/* This is our custom Modal which is based on MUI Modal, but NOT the MUI Modal itself! */}
      <Modal
        open={modalOpen}
        title='Modal title'
        // Clicking on the mask closes the modal or not.
        maskClosable={false}
        size='md'
        // Enable 'esc' to close or not.
        keyboard={false}
        onClose={() => setModalOpen(false)}
        buttons={[
          <Button key='ok' onClick={() => {
            // Handle submit here if necessary.
            setModalOpen(false);
          }}>
            OK
          </Button>,
          <Button key='cancel' onClick={() => setModalOpen(false)}>
            Cancel
          </Button>,
        ]}
      >
        <div>
          <p>Modal content</p>
        </div>
      </Modal>
    </>
  );
}

function ExampleMultiSelect() {
  const [selected, setSelected] = useState<string[]>([]);
  const isMobile = useIsMobile();
  return (
    // Remove selected options by clicking 'X' on the corresponding label.
    <MultiSelect
      // Row layout: selector on the left and selected labels on the right.
      // Col layout: selected labels are above the selector.
      layout={isMobile ? 'col': 'row'}
      gap={isMobile ? 2 : 4}
      label='Select many'
      // Each option can only be chosen once (choosing the same option many times doesn't do anything).
      options={[
        { value: 'v1', label: 'Option 1' },
        { value: 'v2', label: 'Option 2' },
        { value: 'v3', label: 'Option 3' },
        { value: 'v4', label: 'Option 4' },
      ]}
      value={selected}
      onChange={setSelected}
      className='w-full'
    />
  );
}

// `notify` takes a severity and any node. sonner renders the matching icon and colour.
function ExampleNotification() {
  const notify = useNotification();

  return (
    <div className='flex flex-wrap gap-2'>
      {(['success', 'info', 'warning', 'error'] as const).map(severity => (
        <Button
          key={severity}
          variant='outline'
          size='sm'
          onClick={() => notify(severity, `This is a ${severity} notification.`)}
        >
          {severity}
        </Button>
      ))}
    </div>
  );
}

// Events are no-ops unless VITE_MIXPANEL_TOKEN is set, so this is safe to click either way.
function ExampleAnalytics() {
  const { trackEvent } = useAnalytics();
  const notify = useNotification();
  const enabled = Boolean(import.meta.env.VITE_MIXPANEL_TOKEN);

  const sendDemoEvent = () => {
    trackEvent('showcase_demo_clicked', { source: 'showcase', at: new Date().toISOString() });
    notify(
      enabled ? 'success' : 'info',
      enabled
        ? 'Sent `showcase_demo_clicked` to Mixpanel.'
        : 'No VITE_MIXPANEL_TOKEN set — trackEvent() was a no-op.',
    );
  };

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <Button variant='outline' size='sm' onClick={sendDemoEvent}>
          Send test event
        </Button>
        <p className='text-muted-foreground'>
          Mixpanel is {enabled ? 'enabled' : 'disabled'} for this project.
        </p>
      </div>
      <p className='text-muted-foreground'>
        Page views fire automatically on route change; identify/reset follow login and logout.
      </p>
    </div>
  );
}

export default function ShowCase() {
  const user = useStore(state => state.user);
  const [initialized, setInitialized] = useState(false);
  const notify = useNotification();
  const { t } = useTranslation();

  useOneTimeQueryParams(['notifySuccess'], ({ notifySuccessValue }) => {
    if (notifySuccessValue === 'true') {
      notify('info', (
        <p>
          Submit form success.
        </p>
      ));
    }
  });

  useEffect(() => {
    // Simulating initialization, could be for fetching data.
    setTimeout(() => {
      setInitialized(true);
    }, 1000);
  }, [setInitialized]);

  if (!initialized) {
    return <FullScreenLoading />;
  }

  return (
    <div>
      {/* Page heading section, follow the markup, spacing and styling for other pages */}
      <div className='mb-8'>
        <h1 className='text-3xl font-semibold'>H4 for page title</h1>
        <p className='text-muted-foreground'>
          subtitle1 gray for page subtitle if any
        </p>
      </div>

      {/* Use hidden divs with descriptive data-xxx attributes to embed various ids in client-side */}
      {/* Can do this for user ids, various record ids for ids for each item in a list */}
      {/* Useful for debugging (both in dev and prod env) */}
      <div style={{ display: 'none' }} data-userid={_.get(user, '_id')} />

      {/* Content box. Use gap-8 to space the sections inside the content box */}
      <div className='flex flex-col gap-8'>

        <div>
          {/* Use mb-3 for distance between label/section title and content */}
          <div className='mb-3'>
            <h2 className='text-lg font-semibold'>
              Example form with react-hook-form
            </h2>
          </div>
          <ExampleForm />
        </div>

        <div>
          <div className='mb-3'>
            <h2 className='text-lg font-semibold'>
              Image Gallery
            </h2>
          </div>
          <ImageGallery
            images={[
              {
                original: 'https://images.pexels.com/photos/276267/pexels-photo-276267.jpeg',
                thumbnail: 'https://images.pexels.com/photos/276267/pexels-photo-276267.jpeg',
              },
              {
                original: 'https://images.pexels.com/photos/2280549/pexels-photo-2280549.jpeg',
                thumbnail: 'https://images.pexels.com/photos/2280549/pexels-photo-2280549.jpeg',
              },
            ]}
          />
        </div>

        <div>
          <div className='mb-3'>
            <h2 className='text-lg font-semibold'>
              Modal
            </h2>
          </div>
          <ExampleModal />
        </div>

        <div>
          <div className='mb-3'>
            <h2 className='text-lg font-semibold'>
              Multi-select
            </h2>
          </div>
          <ExampleMultiSelect />
        </div>

        <div>
          <div className='mb-3'>
            <h2 className='text-lg font-semibold'>
              Notification
            </h2>
          </div>
          <ExampleNotification />
        </div>

        <div>
          <div className='mb-3'>
            <h2 className='text-lg font-semibold'>
              Analytics
            </h2>
          </div>
          <ExampleAnalytics />
        </div>

        <div>
          <div className='mb-3'>
            <h2 className='text-lg font-semibold'>
              Theme
            </h2>
          </div>
          <div className='flex items-center gap-3'>
            <ThemeToggle />
            <p className='text-muted-foreground'>
              Toggles the <code>.dark</code> class on {'<html>'}; every colour comes from the
              tokens in <code>styles/index.css</code>.
            </p>
          </div>
        </div>

        <div>
          <div className='mb-3'>
            <h2 className='text-lg font-semibold'>
              Info
            </h2>
          </div>
          <div>
            <p>
              A text or a component can have some information explaining about it like this text. The (I) icon will show up next to (on the right) of the component with the explantion in the tooltip.
              <Info text='More explantion you want to let user know' leftSpacing='0.5rem' />
            </p>
          </div>
        </div>

        <div>
          <div className='mb-3'>
            <h2 className='text-lg font-semibold'>
              Link Button
            </h2>
          </div>
          <LinkButton
            href='https://google.com.vn'

          >
            Use middle click to open in a new tab
          </LinkButton>
        </div>

        <div>
          <div className='mb-3'>
            <h2 className='text-lg font-semibold'>
              {t('this_text_is_language_dependent')}
            </h2>
          </div>
          <LanguageSelector />
        </div>

      </div>
    </div>
  );
}
