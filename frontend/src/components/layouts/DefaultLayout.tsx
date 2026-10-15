import { Outlet } from 'react-router';

import Navbar from 'src/components/common/Navbar';
import { MAIN_CONTENT_WIDTH_CLASS } from 'src/utils/constants';

export default function DefaultLayout() {
  return (
    <>
      {/* layout = MAIN/FULL */}
      <Navbar layout='FULL' />
      {/* Spacer for the fixed navbar. */}
      <div className='h-16' />
      <main>
        <div className={`mx-auto mt-7 mb-12 p-4 ${MAIN_CONTENT_WIDTH_CLASS}`}>
          <Outlet /> {/* This will render the nested route */}
        </div>
      </main>
    </>
  );
}
