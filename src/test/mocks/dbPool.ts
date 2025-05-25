import sinon from "sinon";

export let dbQueryStub = sinon.stub();
export const resetMocks = () => {
    dbQueryStub = sinon.stub();
}; 