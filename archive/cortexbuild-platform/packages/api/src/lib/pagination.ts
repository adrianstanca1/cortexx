export function paginate(q:{page?:string;limit?:string}) {
  const page=Math.max(1,parseInt(q.page??'1',10)), limit=Math.min(100,Math.max(1,parseInt(q.limit??'20',10)));
  return {page,limit,offset:(page-1)*limit};
}
export function paginatedResp<T>(rows:T[],page:number,limit:number,total:number) {
  return {data:rows,pagination:{page,pageSize:limit,total,totalPages:Math.ceil(total/limit)}};
}
