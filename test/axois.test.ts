/**
 * @jest-environment node
 */
import nock from 'nock'
import { createAxiosInstance } from '../src'

describe('createAxiosInstance', () => {
  it('change case', async () => {
    nock('http://localhost:8001')
      .post('/echo')
      .reply((_uri, requestBody) => {
        // @ts-ignore
        expect(requestBody.camel_case).toEqual('ok')
        return [200, requestBody, { 'Content-Type': 'application/json' }]
      })
    const http = createAxiosInstance({
      clientBaseURL: 'http://localhost:8001',
      isServer: true,
    })
    await http.post('/echo', {
      camelCase: 'ok',
    })
  })
})
