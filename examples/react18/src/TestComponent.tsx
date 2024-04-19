const TestComponent = () => {
  return (
    <>
      <button
        onClick={() => {
          document.cookie = `cnfdVisitorId=; expires=${new Date(0).toUTCString()}`;
          document.location.reload();
        }}
      >
        Clear cookies and reload
      </button>
    </>
  );
};

export default TestComponent;
