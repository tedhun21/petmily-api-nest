import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/auth.jwt-guard';
import { AuthUser, JwtUser } from 'src/auth/decorater/auth.decorator';
import { ChatsService } from './chats.service';
import { FindMessagesDto } from './dto/find.messages.dto';
import { FindChatRoomsDto } from './dto/find.chatRooms.dto';
import { UpdateUnreadCount } from './dto/update-unreadCount';
import { FindChatRoomByUsersDto } from './dto/find.chatRoomByUsersDto';
import { CreateChatRoomDto } from './dto/create.chatRoom.dto';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @AuthUser() jwtUser: JwtUser,
    @Body() createChatRoomDto: CreateChatRoomDto,
  ) {
    return this.chatsService.createChatRoom(jwtUser, createChatRoomDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findChatRooms(
    @AuthUser() jwtUser: JwtUser,
    @Query() findChatRoomsDto: FindChatRoomsDto,
  ) {
    const { cursor } = findChatRoomsDto;
    console.log(cursor);
    console.log(typeof cursor);
    return this.chatsService.findChatRooms(jwtUser, findChatRoomsDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-users')
  findChatRoomByUsers(
    @AuthUser() jwtUser: JwtUser,
    @Query() query: FindChatRoomByUsersDto,
  ) {
    return this.chatsService.findChatRoomByUsers(jwtUser, query);
  }

  @UseGuards(JwtAuthGuard)
  @Put('unread-counts')
  updateUnreadCount(
    @AuthUser() jwtUser: JwtUser,
    @Query() updateUnreadCountQuery,
    @Body() updateUnreadCount: UpdateUnreadCount,
  ) {
    return this.chatsService.updateUnreadCount(
      jwtUser,
      updateUnreadCountQuery,
      updateUnreadCount,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':chatRoomId')
  findChatRoom(
    @AuthUser() jwtUser: JwtUser,
    @Param('chatRoomId', ParseIntPipe) chatRoomId: number,
  ) {
    return this.chatsService.findChatRoom(jwtUser, chatRoomId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':chatRoomId/messages')
  findMessages(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { chatRoomId: string },
    @Query() findMessagesDto: FindMessagesDto,
  ) {
    return this.chatsService.findMessages(jwtUser, params, findMessagesDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':chatRoomId/messages')
  createMessage(
    @AuthUser() jwtUser: JwtUser,
    @Param() params: { chatRoomId: string },
    @Body() message,
  ) {
    return this.chatsService.createMessage(
      +params.chatRoomId,
      jwtUser,
      message,
    );
  }
}
