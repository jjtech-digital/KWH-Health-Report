import "server-only"

import { executeGraphQL } from "./client"

interface GraphQLTotalResult {
  data?: {
    carts?: { total?: number }
    orders?: { total?: number; results?: Array<{ customerEmail?: string }> }
    customers?: { total?: number }
  }
}

export async function fetchCartTotal(from: string, to: string): Promise<number> {
  const query = `
    query {
      carts(
        where: "lastModifiedAt > \\"${from}\\" AND lastModifiedAt < \\"${to}\\" AND store(key=\\"kwh\\") AND lineItems is defined"
      ) {
        total
      }
    }
  `
  const res = await executeGraphQL<GraphQLTotalResult>(query)
  return res?.data?.carts?.total ?? 0
}

export async function fetchOrderTotal(from: string, to: string): Promise<number> {
  const query = `
    query {
      orders(
        where: "createdAt > \\"${from}\\" AND createdAt < \\"${to}\\" AND store(key=\\"kwh\\")"
      ) {
        total
      }
    }
  `
  const res = await executeGraphQL<GraphQLTotalResult>(query)
  return res?.data?.orders?.total ?? 0
}

export async function fetchLoggedInOrderTotal(from: string, to: string): Promise<number> {
  const query = `
    query {
      orders(
        where: "(customerId is defined) AND createdAt > \\"${from}\\" AND createdAt < \\"${to}\\" AND store(key=\\"kwh\\")"
      ) {
        total
      }
    }
  `
  const res = await executeGraphQL<GraphQLTotalResult>(query)
  return res?.data?.orders?.total ?? 0
}

export async function fetchAnonymousOrderTotal(from: string, to: string): Promise<number> {
  const query = `
    query {
      orders(
        where: "(customerId is not defined) AND createdAt > \\"${from}\\" AND createdAt < \\"${to}\\" AND store(key=\\"kwh\\")"
      ) {
        total
      }
    }
  `
  const res = await executeGraphQL<GraphQLTotalResult>(query)
  return res?.data?.orders?.total ?? 0
}

export async function fetchCustomersCreatedTotal(from: string, to: string): Promise<number> {
  const query = `
    query {
      customers(
        where: "stores(key=\\"kwh\\") AND createdAt > \\"${from}\\" AND createdAt < \\"${to}\\""
      ) {
        total
      }
    }
  `
  const res = await executeGraphQL<GraphQLTotalResult>(query)
  return res?.data?.customers?.total ?? 0
}

export async function fetchRepeatedCustOrderTotal(from: string, to: string): Promise<number> {
  const LIMIT = 500
  let offset = 0
  let fetchedCount = 0
  let totalCount = Infinity

  const seen = new Set<string>()
  const repeated = new Set<string>()

  do {
    const query = `
      query {
        orders(
          limit: ${LIMIT}
          offset: ${offset}
          sort: ["createdAt asc"]
          where: "createdAt > \\"${from}\\" AND createdAt < \\"${to}\\" AND store(key=\\"kwh\\")"
        ) {
          total
          results {
            customerEmail
          }
        }
      }
    `

    const res = await executeGraphQL<GraphQLTotalResult>(query)
    const orders = res?.data?.orders?.results ?? []
    totalCount = res?.data?.orders?.total ?? 0

    for (const order of orders) {
      const email = order.customerEmail
      if (!email) continue
      if (seen.has(email)) {
        repeated.add(email)
      } else {
        seen.add(email)
      }
    }

    fetchedCount += orders.length
    offset += LIMIT
  } while (fetchedCount < totalCount)

  return repeated.size
}

export async function fetchFirstTimeBuyerEmails(
  from: string,
  to: string
): Promise<string[]> {
  const LIMIT = 500
  let offset = 0
  let fetchedCount = 0
  let totalCount = Infinity
  const emails = new Set<string>()

  do {
    const query = `
      query {
        orders(
          limit: ${LIMIT}
          offset: ${offset}
          sort: ["createdAt asc"]
          where: "createdAt > \\"${from}\\" AND createdAt < \\"${to}\\" AND store(key=\\"kwh\\")"
        ) {
          total
          results {
            customerEmail
          }
        }
      }
    `
    const res = await executeGraphQL<GraphQLTotalResult>(query, {
      label: "FIRST_TIME_BUYERS_emails",
    })
    const orders = res?.data?.orders?.results ?? []
    totalCount = res?.data?.orders?.total ?? 0

    for (const order of orders) {
      if (order.customerEmail) {
        emails.add(order.customerEmail)
      }
    }

    fetchedCount += orders.length
    offset += LIMIT
  } while (fetchedCount < totalCount)

  return [...emails]
}

export async function fetchLifetimeOrderCountForEmail(email: string): Promise<number> {
  const escaped = email.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const query = `
    query {
      orders(
        where: "store(key=\\"kwh\\") AND customerEmail=\\"${escaped}\\""
      ) {
        total
      }
    }
  `
  const res = await executeGraphQL<GraphQLTotalResult>(query, {
    label: "FIRST_TIME_BUYERS_email",
  })
  return res?.data?.orders?.total ?? 0
}
