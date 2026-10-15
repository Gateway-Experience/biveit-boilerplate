const PrivacyPolicy = () => {
  // [OPTIONS] populate/user the privacy policy page as needed.
  return (
    <div className='mx-auto max-w-3xl'>
      <div className='py-4'>
        <h1 className='mb-4 text-3xl font-semibold'>
          Privacy Policy
        </h1>

        <p className='mb-4'>
          Last update: {new Date().toLocaleDateString()}
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
